#!/usr/bin/env bash
set -euo pipefail

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required" >&2
  exit 1
}

: "${JWT_PUBLIC_KEY_PEM:?JWT_PUBLIC_KEY_PEM is required}"
VERIFY_PUBLIC_ONLY="${VERIFY_PUBLIC_ONLY:-0}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
private_file="$tmp_dir/private.pem"
public_file="$tmp_dir/public.pem"
derived_public="$tmp_dir/derived-public.pem"

printf '%b' "$JWT_PUBLIC_KEY_PEM" > "$public_file"
openssl pkey -pubin -in "$public_file" -noout >/dev/null 2>&1 || {
  echo "JWT public key is not valid PEM RSA key material" >&2
  exit 1
}

if [[ "$VERIFY_PUBLIC_ONLY" == "1" ]]; then
  echo "JWT public verification key is valid."
  exit 0
fi

: "${JWT_PRIVATE_KEY_PEM:?JWT_PRIVATE_KEY_PEM is required unless VERIFY_PUBLIC_ONLY=1}"
printf '%b' "$JWT_PRIVATE_KEY_PEM" > "$private_file"

openssl pkey -in "$private_file" -check -noout >/dev/null 2>&1 || {
  echo "JWT private signing key is invalid" >&2
  exit 1
}
openssl pkey -in "$private_file" -pubout -out "$derived_public" >/dev/null 2>&1

expected="$(openssl pkey -pubin -in "$public_file" -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $NF}')"
actual="$(openssl pkey -pubin -in "$derived_public" -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $NF}')"

[[ -n "$expected" && "$expected" == "$actual" ]] || {
  echo "JWT private/public keypair mismatch" >&2
  exit 1
}

echo "JWT RS256 signing and verification keypair is valid."
