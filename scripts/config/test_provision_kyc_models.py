from __future__ import annotations

import hashlib
import os
import tempfile
import unittest
from pathlib import Path

from provision_kyc_models import ModelArtifact, provision_models


REPO_ROOT = Path(__file__).resolve().parents[2]


class KycModelProvisioningTests(unittest.TestCase):
    def test_provisions_model_into_anti_spoof_directory(self) -> None:
        payload = b"verified-onnx-payload"
        artifact = ModelArtifact(
            filename="test.onnx",
            url="https://example.invalid/test.onnx",
            sha256=hashlib.sha256(payload).hexdigest(),
        )

        with tempfile.TemporaryDirectory() as tmp:
            downloads: list[str] = []

            def downloader(url: str) -> bytes:
                downloads.append(url)
                return payload

            installed = provision_models(Path(tmp), [artifact], downloader=downloader)

            self.assertEqual(downloads, [artifact.url])
            self.assertEqual(
                installed,
                [Path(tmp) / "anti_spoof_models" / "test.onnx"],
            )
            self.assertEqual(installed[0].read_bytes(), payload)
            self.assertEqual(installed[0].stat().st_mode & 0o777, 0o644)

    def test_rejects_download_when_sha256_does_not_match(self) -> None:
        artifact = ModelArtifact(
            filename="bad.onnx",
            url="https://example.invalid/bad.onnx",
            sha256=hashlib.sha256(b"expected").hexdigest(),
        )

        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(RuntimeError, "SHA-256"):
                provision_models(
                    Path(tmp),
                    [artifact],
                    downloader=lambda _: b"tampered",
                )

            self.assertFalse(
                (Path(tmp) / "anti_spoof_models" / "bad.onnx").exists()
            )

    def test_verified_existing_model_is_reused_without_network_and_permission_is_repaired(self) -> None:
        payload = b"already-present"
        artifact = ModelArtifact(
            filename="cached.onnx",
            url="https://example.invalid/cached.onnx",
            sha256=hashlib.sha256(payload).hexdigest(),
        )

        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "anti_spoof_models" / artifact.filename
            target.parent.mkdir(parents=True)
            target.write_bytes(payload)
            os.chmod(target, 0o600)

            def fail_downloader(_: str) -> bytes:
                raise AssertionError("network should not be used for verified cached model")

            installed = provision_models(
                Path(tmp),
                [artifact],
                downloader=fail_downloader,
            )

            self.assertEqual(installed, [target])
            self.assertEqual(target.stat().st_mode & 0o777, 0o644)

    def test_development_launchers_auto_provision_when_kyc_is_requested(self) -> None:
        powershell = (REPO_ROOT / "up.ps1").read_text(encoding="utf-8")
        bash = (REPO_ROOT / "up.sh").read_text(encoding="utf-8")

        self.assertIn("provision_kyc_models.py", powershell)
        self.assertIn('"kyc"', powershell)
        self.assertIn("provision_kyc_models.py", bash)
        self.assertIn('"kyc"', bash)

    def test_liveness_image_uses_preprocessing_scale_required_by_pinned_models(self) -> None:
        dockerfile = (
            REPO_ROOT / "services" / "liveness_service" / "Dockerfile"
        ).read_text(encoding="utf-8")

        self.assertIn("ENV LIVENESS_INPUT_SCALE=1.0", dockerfile)


if __name__ == "__main__":
    unittest.main()
