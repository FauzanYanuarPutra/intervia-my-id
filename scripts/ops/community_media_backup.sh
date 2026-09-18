#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-.backups/community-media}"
HELPER_IMAGE="${BACKUP_HELPER_IMAGE:-alpine:3.22}"
VOLUME="${COMMUNITY_UPLOADS_VOLUME:-}"

valid_volume_name() {
  [[ "$1" =~ ^[A-Za-z0-9_.-]+$ ]]
}

if [[ -z "$VOLUME" ]]; then
  mapfile -t volumes < <(
    docker ps -q --filter 'label=com.docker.compose.service=community_service' |
      xargs -r docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/app/uploads/forum") (eq .Type "volume")}}{{.Name}}{{println}}{{end}}{{end}}' |
      sed '/^$/d' | sort -u
  )
  if ((${#volumes[@]} != 1)); then
    echo "Unable to resolve exactly one active Community uploads volume. Set COMMUNITY_UPLOADS_VOLUME explicitly." >&2
    exit 1
  fi
  VOLUME="${volumes[0]}"
fi

valid_volume_name "$VOLUME" || { echo "Invalid COMMUNITY_UPLOADS_VOLUME." >&2; exit 1; }
docker volume inspect "$VOLUME" >/dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_ROOT/$timestamp"
mkdir -p "$target"
target_abs="$(cd "$target" && pwd)"

docker run --rm   -v "$VOLUME:/source:ro"   -v "$target_abs:/backup"   "$HELPER_IMAGE"   sh -ceu '
    cd /source
    files="$(find . -type f | wc -l | tr -d " ")"
    bytes="$(du -sb . 2>/dev/null | awk "{print \$1}")"
    tar -czf /backup/community-media.tar.gz .
    printf "%s\n" "$files" > /backup/file-count.txt
    printf "%s\n" "$bytes" > /backup/source-bytes.txt
  '

(
  cd "$target"
  sha256sum community-media.tar.gz > checksums.sha256
  cat > manifest.txt <<EOF
created_at_utc=$timestamp
source_volume=$VOLUME
helper_image=$HELPER_IMAGE
archive=community-media.tar.gz
file_count=$(cat file-count.txt)
source_bytes=$(cat source-bytes.txt)
EOF
  sha256sum -c checksums.sha256
  tar -tzf community-media.tar.gz >/dev/null
)

echo "Community media backup created and verified: $target"
echo "Copy this backup to the encrypted offsite/immutable tier; a same-host snapshot is not disaster recovery."
