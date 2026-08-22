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
                    "GOOGLE_CLIENT_ID": "",
                    "GOOGLE_CLIENT_SECRET": "",
                    "GOOGLE_REDIRECT_URI": "",
                },
                "depends_on": {
                    "redis_cache": {"condition": "service_healthy"},
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
