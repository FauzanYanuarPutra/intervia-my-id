from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Callable

MANIFEST_RELATIVE_PATH = Path(
    "services/marketplace_service/migrations/business_os_immutable_manifest.txt"
)


def git_hash_object(path: Path, repo_root: Path) -> str:
    result = subprocess.run(
        ["git", "hash-object", str(path)],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _parse_manifest_line(line: str, line_number: int) -> tuple[str, str] | str | None:
    stripped = line.rstrip("\n")
    if not stripped or stripped.lstrip().startswith("#"):
        return None

    parts = stripped.split("  ", 1)
    if len(parts) != 2 or not parts[0] or not parts[1] or parts[1].startswith(" "):
        return f"invalid manifest line {line_number}: {stripped}"

    expected, relative_path = parts
    if any(char.isspace() for char in expected):
        return f"invalid manifest line {line_number}: {stripped}"

    return expected, relative_path


def _is_safe_relative_path(relative_path: str) -> bool:
    candidate = Path(relative_path)
    return bool(relative_path) and not candidate.is_absolute() and ".." not in candidate.parts


def verify_manifest(
    repo_root: Path,
    manifest_path: Path,
    hash_file: Callable[[Path], str] | None = None,
) -> list[str]:
    repo_root = repo_root.resolve()
    if not manifest_path.is_absolute():
        manifest_path = repo_root / manifest_path

    if not manifest_path.exists():
        try:
            display = manifest_path.relative_to(repo_root)
        except ValueError:
            display = manifest_path
        return [f"missing manifest: {display}"]

    hasher = hash_file or (lambda path: git_hash_object(path, repo_root))
    errors: list[str] = []
    seen_paths: set[str] = set()

    for line_number, line in enumerate(
        manifest_path.read_text(encoding="utf-8").splitlines(keepends=True),
        start=1,
    ):
        parsed = _parse_manifest_line(line, line_number)
        if parsed is None:
            continue
        if isinstance(parsed, str):
            errors.append(parsed)
            continue

        expected, relative_path = parsed

        if not _is_safe_relative_path(relative_path):
            errors.append(f"unsafe manifest path: {relative_path}")
            continue

        if relative_path in seen_paths:
            errors.append(f"duplicate manifest path: {relative_path}")
            continue
        seen_paths.add(relative_path)

        target = repo_root / relative_path
        if not target.is_file():
            errors.append(f"missing: {relative_path}")
            continue

        actual = hasher(target)
        if actual != expected:
            errors.append(
                f"drift: {relative_path} expected={expected} actual={actual}"
            )

    return sorted(errors)


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    manifest_path = repo_root / MANIFEST_RELATIVE_PATH
    errors = verify_manifest(repo_root, manifest_path)

    if errors:
        print("Business OS migration immutability violations:")
        for error in errors:
            print(f" - {error}")
        print(
            "Applied migrations are immutable. Add a new forward migration instead "
            "of editing protected migration files."
        )
        return 1

    print("Business OS migration immutability manifest verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
