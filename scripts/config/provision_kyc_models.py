#!/usr/bin/env python3
"""Provision pinned KYC liveness models into the local runtime directory."""

from __future__ import annotations

import argparse
import hashlib
import os
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from runtime_contract import parse_env_file


PINNED_MODEL_COMMIT = "584d4421d7ac42c59e640796f46e886b0095367a"
PINNED_MODEL_BASE_URL = (
    "https://raw.githubusercontent.com/"
    "QingHeYang/Silent-Face-Anti-Spoofing-onnx/"
    f"{PINNED_MODEL_COMMIT}/onnx"
)
MODEL_FILE_MODE = 0o644


@dataclass(frozen=True)
class ModelArtifact:
    filename: str
    url: str
    sha256: str


DEFAULT_MODELS = (
    ModelArtifact(
        filename="2.7_80x80_MiniFASNetV2.onnx",
        url=f"{PINNED_MODEL_BASE_URL}/2.7_80x80_MiniFASNetV2.onnx",
        sha256="0cbe5caec95c31de9d2ef845cb85407d76aecd1b6a2c0e343f7d35306bfbccb8",
    ),
    ModelArtifact(
        filename="4_0_0_80x80_MiniFASNetV1SE.onnx",
        url=f"{PINNED_MODEL_BASE_URL}/4_0_0_80x80_MiniFASNetV1SE.onnx",
        sha256="a25886a85cdcfa2c4ea23edb71de35f250c17827b4cadd253a972b28c80fdf1e",
    ),
)

Downloader = Callable[[str], bytes]


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_container_readable(path: Path) -> None:
    """Make a verified model readable by the non-root runtime container user."""
    try:
        os.chmod(path, MODEL_FILE_MODE)
    except OSError as exc:
        raise RuntimeError(f"Unable to set readable permissions on {path}: {exc}") from exc


def download_bytes(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "lajukan-kyc-model-provisioner/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def provision_models(
    root: Path,
    artifacts: Iterable[ModelArtifact] = DEFAULT_MODELS,
    *,
    downloader: Downloader = download_bytes,
) -> list[Path]:
    model_dir = root / "anti_spoof_models"
    model_dir.mkdir(parents=True, exist_ok=True)

    installed: list[Path] = []
    for artifact in artifacts:
        target = model_dir / artifact.filename
        if target.is_file() and sha256_file(target) == artifact.sha256:
            ensure_container_readable(target)
            installed.append(target)
            continue

        payload = downloader(artifact.url)
        actual = sha256_bytes(payload)
        if actual != artifact.sha256:
            raise RuntimeError(
                f"SHA-256 mismatch for {artifact.filename}: expected "
                f"{artifact.sha256}, got {actual}."
            )

        fd, temp_name = tempfile.mkstemp(
            prefix=f".{artifact.filename}.",
            suffix=".tmp",
            dir=model_dir,
        )
        temp_path = Path(temp_name)
        try:
            with os.fdopen(fd, "wb") as destination:
                destination.write(payload)
                destination.flush()
                os.fsync(destination.fileno())
            ensure_container_readable(temp_path)
            temp_path.replace(target)
            ensure_container_readable(target)
        except Exception:
            try:
                temp_path.unlink(missing_ok=True)
            finally:
                raise

        installed.append(target)

    return installed


def resolve_root(env_file: Path | None, explicit_root: Path | None) -> Path:
    if explicit_root is not None:
        return explicit_root.expanduser().resolve()

    env_values = parse_env_file(env_file) if env_file is not None else {}
    configured = env_values.get("LIVENESS_MODELS_PATH", "").strip()
    if not configured:
        configured = os.getenv(
            "LIVENESS_MODELS_PATH",
            "./.runtime/models/liveness",
        ).strip()

    root = Path(configured).expanduser()
    if not root.is_absolute():
        root = Path.cwd() / root
    return root.resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--root", type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    root = resolve_root(args.env_file, args.root)
    print(f"Provisioning KYC liveness models under {root}")
    installed = provision_models(root)
    for path in installed:
        print(f"verified: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
