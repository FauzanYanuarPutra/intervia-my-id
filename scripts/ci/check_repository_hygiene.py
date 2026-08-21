from __future__ import annotations

import subprocess
import sys
from pathlib import PurePosixPath


BANNED_DIRECTORY_NAMES = {
    ".backups",
    ".runtime",
    ".npm-cache",
    "node_modules",
    ".next",
    "target",
    "__pycache__",
}

BANNED_EXACT_FILES = {
    ".docker-build-state",
    ".docker-build-state.json",
}

BANNED_SUFFIXES = (
    ".dump",
    ".dump.gz",
    ".backup",
    ".backup.gz",
    ".sql.gz",
    ".sql.bak",
)

TEMP_IMAGE_PREFIXES = (
    ".codex-",
    "tmp-",
)

TEMP_IMAGE_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
)

REVIEW_ONLY_ROOT_SQL = {
    "community.sql",
    "community_utf8.sql",
    "identity.sql",
    "identity_utf8.sql",
    "marketplace.sql",
    "marketplace_utf8.sql",
}


def run_git_ls_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    return [
        line.strip().replace("\\", "/")
        for line in result.stdout.splitlines()
        if line.strip()
    ]


def contains_banned_directory(path: str) -> bool:
    parts = PurePosixPath(path).parts
    return any(part in BANNED_DIRECTORY_NAMES for part in parts)


def is_banned_exact_file(path: str) -> bool:
    return path in BANNED_EXACT_FILES


def has_banned_suffix(path: str) -> bool:
    normalized = path.lower()
    return normalized.endswith(BANNED_SUFFIXES)


def is_temporary_image(path: str) -> bool:
    filename = PurePosixPath(path).name.lower()

    has_temp_prefix = filename.startswith(TEMP_IMAGE_PREFIXES)
    has_image_suffix = filename.endswith(TEMP_IMAGE_SUFFIXES)

    return has_temp_prefix and has_image_suffix


def main() -> int:
    try:
        tracked_files = run_git_ls_files()
    except subprocess.CalledProcessError as error:
        print("ERROR: gagal membaca tracked Git files.")
        print(error.stderr or error)
        return 2

    violations: list[str] = []
    review_only: list[str] = []

    for path in tracked_files:
        if contains_banned_directory(path):
            violations.append(path)
            continue

        if is_banned_exact_file(path):
            violations.append(path)
            continue

        if has_banned_suffix(path):
            violations.append(path)
            continue

        if is_temporary_image(path):
            violations.append(path)
            continue

        if path in REVIEW_ONLY_ROOT_SQL:
            review_only.append(path)

    print("")
    print("============================================")
    print(" LAJUKAN REPOSITORY HYGIENE CHECK")
    print("============================================")
    print(f"Tracked files checked : {len(tracked_files)}")
    print(f"Violations            : {len(violations)}")
    print(f"SQL review items      : {len(review_only)}")
    print("")

    if review_only:
        print("REVIEW ONLY - jangan hapus otomatis:")
        for path in sorted(review_only):
            print(f"  ? {path}")

        print("")
        print(
            "File SQL di atas harus diklasifikasikan sebagai migration, "
            "seed, fixture, schema reference, atau database dump."
        )
        print("")

    if violations:
        print("FAIL - file berikut tidak boleh tracked Git:")

        for path in sorted(violations):
            print(f"  X {path}")

        print("")
        print(
            "Gunakan `git rm --cached <path>` untuk berhenti tracking "
            "tanpa menghapus file lokal."
        )
        print("")

        return 1

    print("PASS - tidak ditemukan runtime/backup/generated artifact yang dilarang.")
    return 0


if __name__ == "__main__":
    sys.exit(main())