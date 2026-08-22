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


if __name__ == "__main__":
    unittest.main()
