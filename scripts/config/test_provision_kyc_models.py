from __future__ import annotations

import hashlib
import tempfile
import unittest
from pathlib import Path

from provision_kyc_models import ModelArtifact, provision_models


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

    def test_verified_existing_model_is_reused_without_network(self) -> None:
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

            def fail_downloader(_: str) -> bytes:
                raise AssertionError("network should not be used for verified cached model")

            installed = provision_models(
                Path(tmp),
                [artifact],
                downloader=fail_downloader,
            )

            self.assertEqual(installed, [target])


if __name__ == "__main__":
    unittest.main()
