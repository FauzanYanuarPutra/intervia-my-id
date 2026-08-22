from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from runtime_contract import validate_contract


def base_model(liveness_source: Path) -> dict:
    return {
        "services": {
            "www": {
                "environment": {
                    "REDIS_URL": "redis://:dev@redis_cache:6379",
                    "INTERNAL_API_URL": "http://identity_service:8080",
                    "NEXT_PUBLIC_WWW_URL": "http://localhost:3000",
                    "GOOGLE_CLIENT_ID": "",
                    "GOOGLE_CLIENT_SECRET": "",
                    "WWW_GOOGLE_REDIRECT_URI": "",
                },
                "depends_on": {
                    "redis_cache": {"condition": "service_healthy"},
                },
            },
            "usaha": {
                "environment": {
                    "NEXT_PUBLIC_USAHA_URL": "http://localhost:3003",
                    "GOOGLE_CLIENT_ID": "",
                    "GOOGLE_CLIENT_SECRET": "",
                    "USAHA_GOOGLE_REDIRECT_URI": "",
                },
            },
            "identity_service": {"environment": {"GOOGLE_CLIENT_ID": ""}},
            "liveness_service": {
                "environment": {
                    "LIVENESS_MODEL_DIR": "/models/anti_spoof_models",
                },
                "volumes": [
                    {
                        "type": "bind",
                        "source": str(liveness_source),
                        "target": "/models",
                        "read_only": True,
                    }
                ],
            },
            "caddy": {},
            "cloudflared": {
                "depends_on": {
                    "caddy": {"condition": "service_started"},
                },
            },
        }
    }


def configure_google_oauth(model: dict) -> None:
    client_id = "shared-client.apps.googleusercontent.com"
    client_secret = "shared-secret"
    model["services"]["www"]["environment"].update(
        {
            "GOOGLE_CLIENT_ID": client_id,
            "GOOGLE_CLIENT_SECRET": client_secret,
            "WWW_GOOGLE_REDIRECT_URI": "http://localhost:3000/api/auth/google/callback",
        }
    )
    model["services"]["usaha"]["environment"].update(
        {
            "GOOGLE_CLIENT_ID": client_id,
            "GOOGLE_CLIENT_SECRET": client_secret,
            "USAHA_GOOGLE_REDIRECT_URI": "http://localhost:3003/api/auth/google/callback",
        }
    )
    model["services"]["identity_service"]["environment"]["GOOGLE_CLIENT_ID"] = client_id


class GoogleOauthRuntimeContractTests(unittest.TestCase):
    def test_google_oauth_requires_usaha_configuration_when_shared_client_is_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)
            model["services"]["usaha"]["environment"]["GOOGLE_CLIENT_SECRET"] = ""

            errors = validate_contract(model, {}, "development", set())

        self.assertTrue(
            any("Usaha Google OAuth configuration is partial" in error for error in errors),
            errors,
        )

    def test_google_oauth_requires_same_client_id_across_www_usaha_and_identity(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)
            model["services"]["usaha"]["environment"]["GOOGLE_CLIENT_ID"] = (
                "different-client.apps.googleusercontent.com"
            )

            errors = validate_contract(model, {}, "development", set())

        self.assertTrue(
            any("same Google OAuth client ID" in error for error in errors),
            errors,
        )

    def test_google_oauth_requires_explicit_www_redirect_environment_name(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)
            www_environment = model["services"]["www"]["environment"]
            www_environment["GOOGLE_REDIRECT_URI"] = www_environment.pop(
                "WWW_GOOGLE_REDIRECT_URI"
            )

            errors = validate_contract(model, {}, "development", set())

        self.assertTrue(
            any("WWW_GOOGLE_REDIRECT_URI" in error for error in errors),
            errors,
        )

    def test_google_oauth_requires_distinct_www_and_usaha_redirect_origins(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)
            model["services"]["usaha"]["environment"]["USAHA_GOOGLE_REDIRECT_URI"] = (
                "http://localhost:3000/api/auth/google/callback"
            )

            errors = validate_contract(model, {}, "development", set())

        self.assertTrue(
            any("Usaha Google OAuth redirect origin" in error for error in errors),
            errors,
        )

    def test_google_oauth_requires_https_for_both_callbacks_outside_development(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)
            model["services"]["www"]["environment"].update(
                {
                    "NEXT_PUBLIC_WWW_URL": "https://www.lajukan.com",
                    "WWW_GOOGLE_REDIRECT_URI": "https://www.lajukan.com/api/auth/google/callback",
                }
            )
            model["services"]["usaha"]["environment"].update(
                {
                    "NEXT_PUBLIC_USAHA_URL": "https://usaha.lajukan.com",
                    "USAHA_GOOGLE_REDIRECT_URI": "http://usaha.lajukan.com/api/auth/google/callback",
                }
            )

            errors = validate_contract(model, {}, "production", set())

        self.assertTrue(
            any("Usaha Google OAuth redirect must use HTTPS" in error for error in errors),
            errors,
        )

    def test_google_oauth_accepts_one_shared_client_with_two_callbacks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            model = base_model(Path(tmp))
            configure_google_oauth(model)

            errors = validate_contract(model, {}, "development", set())

        google_errors = [error for error in errors if "Google OAuth" in error]
        self.assertEqual(google_errors, [], google_errors)


class KycRuntimeContractTests(unittest.TestCase):
    def test_kyc_rejects_empty_liveness_model_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "liveness"
            source.mkdir(parents=True)

            errors = validate_contract(
                base_model(source),
                {},
                "development",
                {"kyc"},
            )

            self.assertTrue(
                any(
                    "anti-spoof" in error.lower() and ".onnx" in error.lower()
                    for error in errors
                ),
                errors,
            )

    def test_kyc_accepts_at_least_one_anti_spoof_onnx_model(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "liveness"
            model_dir = source / "anti_spoof_models"
            model_dir.mkdir(parents=True)
            (model_dir / "model.onnx").write_bytes(b"test-model-placeholder")

            errors = validate_contract(
                base_model(source),
                {},
                "development",
                {"kyc"},
            )

            self.assertFalse(
                any("anti-spoof" in error.lower() for error in errors),
                errors,
            )


class TunnelRuntimeContractTests(unittest.TestCase):
    def test_tunnel_rejects_localhost_app_domain(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            errors = validate_contract(
                base_model(Path(tmp)),
                {
                    "CLOUDFLARE_TUNNEL_TOKEN": "rotated-token",
                    "APP_DOMAIN": "localhost",
                    "NEXT_PUBLIC_APP_URL": "https://www.lajukan.com",
                },
                "development",
                {"tunnel"},
            )

        self.assertTrue(
            any("APP_DOMAIN" in error and "localhost" in error for error in errors),
            errors,
        )

    def test_tunnel_rejects_non_https_public_app_url(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            errors = validate_contract(
                base_model(Path(tmp)),
                {
                    "CLOUDFLARE_TUNNEL_TOKEN": "rotated-token",
                    "APP_DOMAIN": "lajukan.com",
                    "NEXT_PUBLIC_APP_URL": "http://www.lajukan.com",
                },
                "development",
                {"tunnel"},
            )

        self.assertTrue(
            any("NEXT_PUBLIC_APP_URL" in error and "HTTPS" in error for error in errors),
            errors,
        )

    def test_tunnel_accepts_public_domain_and_https_origin(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            errors = validate_contract(
                base_model(Path(tmp)),
                {
                    "CLOUDFLARE_TUNNEL_TOKEN": "rotated-token",
                    "APP_DOMAIN": "lajukan.com",
                    "NEXT_PUBLIC_APP_URL": "https://www.lajukan.com",
                },
                "development",
                {"tunnel"},
            )

        tunnel_errors = [
            error
            for error in errors
            if "Tunnel" in error or "APP_DOMAIN" in error or "NEXT_PUBLIC_APP_URL" in error
        ]
        self.assertEqual(tunnel_errors, [], tunnel_errors)


if __name__ == "__main__":
    unittest.main()
