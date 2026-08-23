from __future__ import annotations

import re
import unittest
from pathlib import Path

from launcher_profiles import resolve_profiles
from tunnel_readiness import active_ha_connections, metrics_report_healthy


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


class TunnelReadinessTests(unittest.TestCase):
    def test_metrics_parser_reports_active_ha_connections(self) -> None:
        metrics = """
# HELP cloudflared_tunnel_ha_connections Number of active ha connections
# TYPE cloudflared_tunnel_ha_connections gauge
cloudflared_tunnel_ha_connections 4
"""
        self.assertEqual(active_ha_connections(metrics), 4.0)
        self.assertTrue(metrics_report_healthy(metrics))

    def test_metrics_parser_rejects_zero_or_missing_connections(self) -> None:
        self.assertFalse(metrics_report_healthy("cloudflared_tunnel_ha_connections 0\n"))
        self.assertFalse(metrics_report_healthy("build_info{version=\"2026.7.3\"} 1\n"))

    def test_launchers_use_current_tunnel_state_not_recent_log_window(self) -> None:
        for launcher in ("up.ps1", "up.sh"):
            with self.subTest(launcher=launcher):
                source = (ROOT / launcher).read_text(encoding="utf-8")
                self.assertIn("tunnel_readiness.py", source)
                self.assertNotIn("--since 2m", source)


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

    def test_development_frontend_csp_is_owned_by_next(self) -> None:
        """Caddy must not add a second CSP that intersects with Next.js CSP."""
        caddy = self._read_caddy("Caddyfile")
        self.assertNotIn("Content-Security-Policy", caddy)

        for app in ("www", "usaha", "cms", "crm"):
            with self.subTest(app=app):
                next_config = (
                    ROOT / f"frontend/apps/{app}/next.config.mjs"
                ).read_text(encoding="utf-8")
                self.assertIn("buildPublicWebCsp", next_config)
                self.assertIn("buildSecurityHeaders", next_config)

    def test_caddy_shares_media_network_with_minio(self) -> None:
        """Caddy must be able to resolve minio:9002 for media.lajukan.com."""
        compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
        caddy = re.search(
            r"(?ms)^  caddy:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_]+:\n|^networks:\n)",
            compose,
        )
        self.assertIsNotNone(caddy)
        body = caddy.group("body") if caddy else ""
        self.assertRegex(body, r"networks:\s*\[[^\]]*\bmedia\b[^\]]*\]")

    def test_tunnel_frontends_forward_external_https_scheme(self) -> None:
        """The private Tunnel hop must not overwrite the browser HTTPS scheme."""
        caddy = self._read_caddy("Caddyfile")

        snippet = re.search(
            r"\(public_frontend_proxy\)\s*\{(?P<body>.*?)\n\}",
            caddy,
            re.DOTALL,
        )
        self.assertIsNotNone(snippet)
        body = snippet.group("body") if snippet else ""
        self.assertIn("header_up X-Forwarded-Proto https", body)
        self.assertIn("header_up X-Forwarded-Host {host}", body)

        for upstream in ("www:3000", "usaha:3003", "cms:3001", "crm:3002"):
            with self.subTest(upstream=upstream):
                pattern = re.compile(
                    rf"reverse_proxy\s+{re.escape(upstream)}\s*\{{[^}}]*"
                    r"import\s+public_frontend_proxy",
                    re.DOTALL,
                )
                self.assertRegex(caddy, pattern)

    def test_launchers_validate_and_reload_running_caddy(self) -> None:
        """Bind-mounted Caddyfile changes must be activated on every edge startup."""
        for launcher in ("up.ps1", "up.sh"):
            with self.subTest(launcher=launcher):
                source = (ROOT / launcher).read_text(encoding="utf-8")
                self.assertIn("caddy validate --config /etc/caddy/Caddyfile", source)
                self.assertIn("caddy reload --config /etc/caddy/Caddyfile", source)


class OAuthNavigationContractTests(unittest.TestCase):
    def test_usaha_google_oauth_uses_full_document_navigation(self) -> None:
        """External OAuth redirects must not be followed by Next router fetches."""
        source = (
            ROOT / "frontend/apps/usaha/src/app/login/page.tsx"
        ).read_text(encoding="utf-8")

        self.assertNotIn("from 'next/link'", source)
        self.assertRegex(source, r"<a\s+[^>]*href=\{googleHref\}")
        self.assertNotRegex(source, r"<Link\s+[^>]*href=\{googleHref\}")


if __name__ == "__main__":
    unittest.main()
