#!/usr/bin/env bash
set -euo pipefail

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required" >&2
  exit 1
}

KEY_BITS="${KEY_BITS:-3072}"
OUTPUT_DIR="${OUTPUT_DIR:-./.runtime/jwt-access}"

[[ "$KEY_BITS" =~ ^[0-9]+$ ]] || {
  echo "KEY_BITS must be numeric" >&2
  exit 1
}
if (( KEY_BITS < 2048 )); then
  echo "KEY_BITS must be at least 2048" >&2
  exit 1
fi

umask 077
mkdir -p "$OUTPUT_DIR"
private_key="$OUTPUT_DIR/private.pem"
public_key="$OUTPUT_DIR/public.pem"
env_fragment="$OUTPUT_DIR/jwt-access.env"

[[ ! -e "$private_key" && ! -e "$public_key" && ! -e "$env_fragment" ]] || {
  echo "Refusing to overwrite existing JWT key material in $OUTPUT_DIR" >&2
  exit 1
}

openssl genpkey   -algorithm RSA   -pkeyopt "rsa_keygen_bits:$KEY_BITS"   -out "$private_key" >/dev/null 2>&1
openssl pkey -in "$private_key" -pubout -out "$public_key" >/dev/null 2>&1

escape_pem() {
  awk '{ printf "%s\\n", $0 }' "$1"
}

{
  echo "JWT_ACCESS_ALG=RS256"
  printf 'JWT_PRIVATE_KEY_PEM=%s\n' "$(escape_pem "$private_key")"
  printf 'JWT_PUBLIC_KEY_PEM=%s\n' "$(escape_pem "$public_key")"
  printf 'JWT_KEY_ID=%s\n' "${JWT_KEY_ID:-lajukan-access-v1}"
} > "$env_fragment"

chmod 600 "$private_key" "$env_fragment"
chmod 644 "$public_key"

echo "JWT access keypair generated in $OUTPUT_DIR"
echo "Private key and env fragment are mode 600. Do not commit or print their contents."
echo "Verify the pair with:"
echo "  JWT_PRIVATE_KEY_PEM='<escaped private pem>' JWT_PUBLIC_KEY_PEM='<escaped public pem>' scripts/ops/verify_jwt_access_keypair.sh"
