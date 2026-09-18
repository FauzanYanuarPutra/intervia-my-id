#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" ]] || { echo "Usage: $0 <community-media-backup-dir>" >&2; exit 2; }
[[ -d "$BACKUP_DIR" ]] || { echo "Backup directory not found: $BACKUP_DIR" >&2; exit 1; }

for file in community-media.tar.gz checksums.sha256 manifest.txt file-count.txt source-bytes.txt; do
  [[ -s "$BACKUP_DIR/$file" ]] || { echo "Missing/non-empty backup artifact: $file" >&2; exit 1; }
done

(
  cd "$BACKUP_DIR"
  sha256sum -c checksums.sha256
  tar -tzf community-media.tar.gz >/dev/null

  file_count="$(cat file-count.txt)"
  source_bytes="$(cat source-bytes.txt)"
  [[ "$file_count" =~ ^[0-9]+$ ]] || { echo "Invalid file-count.txt" >&2; exit 1; }
  [[ "$source_bytes" =~ ^[0-9]+$ ]] || { echo "Invalid source-bytes.txt" >&2; exit 1; }
)

echo "Community media backup verification passed: $BACKUP_DIR"
