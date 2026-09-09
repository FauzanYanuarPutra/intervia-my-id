from __future__ import annotations

import re
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


class RuntimeSecurityContractTests(unittest.TestCase):
    def _read_caddy(self, name: str) -> str:
        return (ROOT / "infrastructure/caddy" / name).read_text(encoding="utf-8")

    def test_auth_routes_are_explicitly_non_cacheable_at_the_edge(self) -> None:
        """Sensitive auth responses must never be stored by browsers or intermediaries."""
        for name in ("Caddyfile", "Caddyfile.prod"):
            with self.subTest(caddyfile=name):
                caddy = self._read_caddy(name)
                self.assertIn("@auth_no_store path /auth /auth/*", caddy)
                self.assertIn('header @auth_no_store Cache-Control "no-store"', caddy)
                self.assertIn('header @auth_no_store Pragma "no-cache"', caddy)

    def test_production_edge_security_headers_cover_non_next_hosts(self) -> None:
        """API/media/chat responses also need scanner-visible hardening at Caddy."""
        caddy = self._read_caddy("Caddyfile.prod")
        snippet = re.search(
            r"\(security_headers\)\s*\{(?P<body>.*?)\n\}",
            caddy,
            re.DOTALL,
        )
        self.assertIsNotNone(snippet)
        body = snippet.group("body") if snippet else ""

        for expected in (
            "-Server",
            'Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"',
            'X-Content-Type-Options "nosniff"',
            'X-Frame-Options "DENY"',
            'X-Permitted-Cross-Domain-Policies "none"',
            'Referrer-Policy "strict-origin-when-cross-origin"',
            'Permissions-Policy "camera=(), microphone=(), geolocation=(self)"',
        ):
            with self.subTest(header=expected):
                self.assertIn(expected, body)


if __name__ == "__main__":
    unittest.main()
