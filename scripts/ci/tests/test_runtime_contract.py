from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
COMPOSE_FILES = (
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.dev.yml",
)
EXAMPLE_ENV = ".env.development.example"


def run_compose(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        (
            "docker",
            "compose",
            "--env-file",
            EXAMPLE_ENV,
            *COMPOSE_FILES,
            *args,
        ),
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


class ComposeRuntimeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        result = run_compose("config", "--format", "json")
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        cls.model = json.loads(result.stdout)

    def test_www_receives_authenticated_internal_redis_and_waits_for_health(self) -> None:
        www = self.model["services"]["www"]

        self.assertIn("REDIS_URL", www["environment"])
        self.assertIn("@redis_cache:6379", www["environment"]["REDIS_URL"])
        self.assertEqual(
            {"condition": "service_healthy", "required": True},
            www["depends_on"]["redis_cache"],
        )

    def test_www_uses_identity_service_for_server_side_identity_calls(self) -> None:
        environment = self.model["services"]["www"]["environment"]

        self.assertEqual(
            "http://identity_service:8080",
            environment["INTERNAL_API_URL"],
        )
        self.assertEqual(
            "http://localhost:8080",
            environment["NEXT_PUBLIC_API_URL"],
        )

    def test_www_rate_limit_policy_cannot_be_configured_fail_open(self) -> None:
        environment = self.model["services"]["www"]["environment"]

        self.assertNotIn("RATE_LIMIT_FAIL_OPEN", environment)

    def test_www_and_redis_share_only_a_dedicated_cache_network(self) -> None:
        services = self.model["services"]
        www_networks = set(services["www"]["networks"])
        redis_networks = set(services["redis_cache"]["networks"])

        self.assertIn("cache", www_networks & redis_networks)
        self.assertNotIn("data", www_networks)

    def test_www_and_minio_share_only_a_dedicated_media_network(self) -> None:
        services = self.model["services"]
        www_networks = set(services["www"]["networks"])
        minio_networks = set(services["minio"]["networks"])

        self.assertIn("media", www_networks & minio_networks)
        self.assertNotIn("data", www_networks)

    def test_www_receives_complete_google_oauth_runtime_keys(self) -> None:
        environment = self.model["services"]["www"]["environment"]

        for key in (
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "GOOGLE_REDIRECT_URI",
        ):
            with self.subTest(key=key):
                self.assertIn(key, environment)

    def test_google_client_secret_is_not_exposed_to_identity(self) -> None:
        identity_environment = self.model["services"]["identity_service"]["environment"]

        self.assertNotIn("GOOGLE_CLIENT_SECRET", identity_environment)

    def test_login_and_registration_otp_policies_are_independent(self) -> None:
        environment = self.model["services"]["www"]["environment"]

        self.assertEqual("false", environment["LOGIN_OTP_REQUIRED"])
        self.assertEqual("true", environment["REGISTER_OTP_REQUIRED"])

    def test_www_receives_explicit_feature_runtime_contract(self) -> None:
        environment = self.model["services"]["www"]["environment"]

        for key in (
            "MINIO_ENDPOINT",
            "MINIO_ACCESS_KEY",
            "MINIO_SECRET_KEY",
            "MINIO_BUCKET",
            "NEXT_PUBLIC_MARKETPLACE_URL",
            "NEXT_PUBLIC_COMMUNITY_URL",
            "NEXT_PUBLIC_CHAT_WS_URL",
            "CREATOR_INITIAL_COINS",
            "WHATSAPP_META_API_VERSION",
            "WHATSAPP_META_ACCESS_TOKEN",
            "NEXT_PUBLIC_STUN_URLS",
            "TURN_SHARED_SECRET",
            "AI_LEARNING_ENABLED",
            "AI_LEARNING_LOG_DIR",
            "AI_LEARNING_MEMORY_FILE",
            "PERSONAL_AI_STORE_DIR",
            "IMAGE_AI_ASSIST_ENABLED",
            "NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED",
            "NEXT_PUBLIC_DISABLE_PWA",
        ):
            with self.subTest(key=key):
                self.assertIn(key, environment)

    def test_www_public_configuration_is_available_during_image_build(self) -> None:
        build_args = self.model["services"]["www"]["build"]["args"]

        for key in (
            "NEXT_PUBLIC_APP_ENV",
            "NEXT_PUBLIC_APP_URL",
            "NEXT_PUBLIC_WWW_URL",
            "NEXT_PUBLIC_MARKETPLACE_URL",
            "NEXT_PUBLIC_COMMUNITY_URL",
            "NEXT_PUBLIC_CHAT_WS_URL",
            "NEXT_PUBLIC_LOGIN_OTP_REQUIRED",
        ):
            with self.subTest(key=key):
                self.assertIn(key, build_args)

    def test_www_runtime_files_survive_container_recreation(self) -> None:
        volumes = self.model["services"]["www"]["volumes"]

        self.assertTrue(
            any(
                volume.get("target") == "/app/apps/www/.runtime"
                and volume.get("type") == "volume"
                for volume in volumes
            )
        )

    def test_edge_profile_resolves_without_backoffice_profile(self) -> None:
        result = run_compose("--profile", "edge", "config", "--format", "json")

        self.assertEqual(0, result.returncode, result.stderr)
        model = json.loads(result.stdout)
        self.assertIn("caddy", model["services"])
        self.assertNotIn("cms", model["services"])
        self.assertNotIn("crm", model["services"])
        self.assertNotIn("usaha", model["services"])
        self.assertTrue(
            all(
                published.get("host_ip") == "127.0.0.1"
                for published in model["services"]["caddy"]["ports"]
            )
        )

    def test_tunnel_is_opt_in_and_layers_in_front_of_caddy(self) -> None:
        self.assertNotIn("cloudflared", self.model["services"])

        result = run_compose("--profile", "tunnel", "config", "--format", "json")
        self.assertEqual(0, result.returncode, result.stderr)
        model = json.loads(result.stdout)
        tunnel = model["services"]["cloudflared"]
        self.assertIn("caddy", tunnel["depends_on"])

    def test_launchers_wait_for_health_and_tunnel_edge_registration(self) -> None:
        for relative_path in ("up.ps1", "up.sh"):
            with self.subTest(launcher=relative_path):
                source = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
                self.assertIn("--wait", source)
                self.assertIn("Registered tunnel connection", source)


class RuntimeValidatorCliTests(unittest.TestCase):
    def run_validator(
        self,
        model: dict[str, object],
        env_text: str,
        *profiles: str,
    ) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model_path = root / "model.json"
            env_path = root / ".env.test"
            model_path.write_text(json.dumps(model), encoding="utf-8")
            env_path.write_text(env_text, encoding="utf-8")
            command = [
                sys.executable,
                "scripts/config/runtime_contract.py",
                "--model",
                str(model_path),
                "--env-file",
                str(env_path),
                "--environment",
                "development",
            ]
            for profile in profiles:
                command.extend(("--profile", profile))
            return subprocess.run(
                command,
                cwd=REPO_ROOT,
                check=False,
                capture_output=True,
                text=True,
            )

    @staticmethod
    def valid_model() -> dict[str, object]:
        return {
            "services": {
                "redis_cache": {"healthcheck": {"test": ["CMD", "true"]}},
                "www": {
                    "environment": {
                        "REDIS_URL": "redis://:redacted@redis_cache:6379",
                        "INTERNAL_API_URL": "http://identity_service:8080",
                        "GOOGLE_CLIENT_ID": "",
                        "GOOGLE_CLIENT_SECRET": "",
                        "GOOGLE_REDIRECT_URI": "http://localhost:3000/api/auth/google/callback",
                    },
                    "depends_on": {
                        "redis_cache": {
                            "condition": "service_healthy",
                            "required": True,
                        }
                    },
                },
            }
        }

    def test_valid_contract_exits_zero_without_printing_values(self) -> None:
        result = self.run_validator(self.valid_model(), "CLOUDFLARE_TUNNEL_TOKEN=\n")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertNotIn("redacted", result.stdout + result.stderr)

    def test_partial_google_configuration_is_rejected(self) -> None:
        model = self.valid_model()
        www = model["services"]["www"]  # type: ignore[index]
        www["environment"]["GOOGLE_CLIENT_ID"] = "configured-client"  # type: ignore[index]

        result = self.run_validator(model, "")

        self.assertEqual(1, result.returncode)
        self.assertIn("Google OAuth configuration is partial", result.stderr)
        self.assertNotIn("configured-client", result.stderr)

    def test_www_localhost_redis_is_rejected(self) -> None:
        model = self.valid_model()
        www = model["services"]["www"]  # type: ignore[index]
        www["environment"]["REDIS_URL"] = "redis://localhost:6379"  # type: ignore[index]

        result = self.run_validator(model, "")

        self.assertEqual(1, result.returncode)
        self.assertIn("WWW Redis must use the redis_cache service", result.stderr)
        self.assertNotIn("redis://localhost:6379", result.stderr)

    def test_www_localhost_identity_url_is_rejected(self) -> None:
        model = self.valid_model()
        www = model["services"]["www"]  # type: ignore[index]
        www["environment"]["INTERNAL_API_URL"] = "http://localhost:8080"  # type: ignore[index]

        result = self.run_validator(model, "")

        self.assertEqual(1, result.returncode)
        self.assertIn("WWW Identity must use the identity_service service", result.stderr)

    def test_fail_open_rate_limit_override_is_rejected(self) -> None:
        model = self.valid_model()
        www = model["services"]["www"]  # type: ignore[index]
        www["environment"]["RATE_LIMIT_FAIL_OPEN"] = "true"  # type: ignore[index]

        result = self.run_validator(model, "")

        self.assertEqual(1, result.returncode)
        self.assertIn("Rate limiting must fail closed", result.stderr)

    def test_tunnel_profile_requires_non_empty_token(self) -> None:
        model = self.valid_model()
        model["services"]["cloudflared"] = {  # type: ignore[index]
            "depends_on": {"caddy": {"condition": "service_started"}}
        }

        result = self.run_validator(
            model,
            "CLOUDFLARE_TUNNEL_TOKEN=\n",
            "tunnel",
        )

        self.assertEqual(1, result.returncode)
        self.assertIn("Tunnel profile requires CLOUDFLARE_TUNNEL_TOKEN", result.stderr)


if __name__ == "__main__":
    unittest.main()
