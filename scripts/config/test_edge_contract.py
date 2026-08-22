from __future__ import annotations

import unittest
from pathlib import Path

from launcher_profiles import resolve_profiles


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


class LauncherProfileTests(unittest.TestCase):
    def test_development_token_auto_enables_tunnel(self) -> None:
        profiles = resolve_profiles(
            {"CLOUDFLARE_TUNNEL_TOKEN": "rotated-token"},
            "development",
            [],
        )

        self.assertIn("tunnel", profiles)

    def test_auto_tunnel_can_be_disabled(self) -> None:
        profiles = resolve_profiles(
            {
                "CLOUDFLARE_TUNNEL_TOKEN": "rotated-token",
                "CLOUDFLARE_TUNNEL_AUTO_START": "false",
            },
            "development",
            [],
        )

        self.assertNotIn("tunnel", profiles)

    def test_staging_and_production_do_not_auto_enable_tunnel(self) -> None:
        for environment in ("staging", "production"):
            with self.subTest(environment=environment):
                profiles = resolve_profiles(
                    {"CLOUDFLARE_TUNNEL_TOKEN": "configured-token"},
                    environment,
                    [],
                )
                self.assertNotIn("tunnel", profiles)

    def test_env_and_cli_profiles_are_deduplicated(self) -> None:
        profiles = resolve_profiles(
            {"COMPOSE_PROFILES": "edge,backoffice"},
            "development",
            ["backoffice,tunnel", "kyc"],
        )

        self.assertEqual(
            profiles,
            ["edge", "backoffice", "tunnel", "kyc"],
        )

    def test_launchers_use_shared_profile_resolver(self) -> None:
        self.assertIn(
            "launcher_profiles.py",
            (ROOT / "up.ps1").read_text(encoding="utf-8"),
        )
        self.assertIn(
            "launcher_profiles.py",
            (ROOT / "up.sh").read_text(encoding="utf-8"),
        )


class CaddyEdgeContractTests(unittest.TestCase):
    def _read_caddy(self, name: str) -> str:
        return (ROOT / "infrastructure/caddy" / name).read_text(encoding="utf-8")

    def test_development_public_routes_reach_expected_internal_services(self) -> None:
        caddy = self._read_caddy("Caddyfile")
        expected = {
            "cms.{$APP_DOMAIN}": "cms:3001",
            "crm.{$APP_DOMAIN}": "crm:3002",
            "chat.{$APP_DOMAIN}": "chat_service:4000",
            "media.{$APP_DOMAIN}": "minio:9002",
        }
        for host, upstream in expected.items():
            with self.subTest(host=host):
                self.assertIn(f"http://{host}", caddy)
                self.assertIn(f"reverse_proxy {upstream}", caddy)

    def test_api_gateway_has_all_backend_upstreams_in_both_caddyfiles(self) -> None:
        for name in ("Caddyfile", "Caddyfile.prod"):
            with self.subTest(caddyfile=name):
                caddy = self._read_caddy(name)
                self.assertIn("api.{$APP_DOMAIN}", caddy)
                self.assertIn("reverse_proxy identity_service:8080", caddy)
                self.assertIn("reverse_proxy marketplace_service:8081", caddy)
                self.assertIn("reverse_proxy community_service:8082", caddy)
                self.assertIn("/auth/*", caddy)
                self.assertIn("/v1/community/*", caddy)

    def test_media_origin_exists_in_both_caddyfiles(self) -> None:
        for name in ("Caddyfile", "Caddyfile.prod"):
            with self.subTest(caddyfile=name):
                caddy = self._read_caddy(name)
                self.assertIn("media.{$APP_DOMAIN}", caddy)
                self.assertIn("reverse_proxy minio:9002", caddy)

    def test_development_apex_redirect_is_external_https(self) -> None:
        caddy = self._read_caddy("Caddyfile")
        self.assertIn("redir https://www.{$APP_DOMAIN}{uri} permanent", caddy)


if __name__ == "__main__":
    unittest.main()
