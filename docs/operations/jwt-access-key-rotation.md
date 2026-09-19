# Access-token signing and rotation

Lajukan supports a migration-safe access-token trust boundary:

- development may use `JWT_ACCESS_ALG=HS256`;
- staging and production use `JWT_ACCESS_ALG=RS256`;
- Identity owns `JWT_PRIVATE_KEY_PEM` and signs access tokens;
- Marketplace, Community, and Chat receive only `JWT_PUBLIC_KEY_PEM`;
- `JWT_KEY_ID` identifies the active signing generation.

Staging and production are fail-closed: configuring `HS256`, omitting the RS256 public key, or omitting Identity's private signing key prevents a valid production rollout instead of silently falling back to a shared signing secret.

The PEM values are stored in server-managed environment/secrets as a single
escaped line, with literal `\n` between PEM lines. Never commit generated key
material.

## Generate a pair

Run:

```bash
OUTPUT_DIR=./.runtime/jwt-access \
  JWT_KEY_ID=lajukan-access-v1 \
  scripts/ops/generate_jwt_access_keypair.sh
```

The command creates a private key, public key, and mode-600 environment
fragment. It refuses to overwrite existing key material.

Before configuring an environment, verify that the pair matches:

```bash
JWT_PRIVATE_KEY_PEM='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n' \
JWT_PUBLIC_KEY_PEM='-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n' \
scripts/ops/verify_jwt_access_keypair.sh
```

The verifier never prints key material.

## Rollout

1. Generate the new pair outside Git.
2. Put the private key only in the Identity runtime secret scope.
3. Put the public key in every access-token verifier.
4. Set the same `JWT_KEY_ID`, issuer, and audience across those runtimes.
5. Verify the pair before deployment.
6. Deploy verifier support before switching the signer when migrating an
   existing environment.
7. Switch Identity to RS256 and run authentication/login/refresh smoke tests.
8. Keep the previous key available only for the bounded token lifetime if a
   dual-key/JWKS rotation mechanism is introduced later.

The current implementation intentionally supports one active RS256 key. A
future JWKS key ring can add overlapping old/new verification keys without
returning to a shared signing secret.

## Rollback

If the RS256 rollout fails before tokens are issued, restore the previous
configuration. If RS256 tokens have already been issued, do not blindly switch
verifiers back to HS256: doing so invalidates active access tokens. Either keep
the public verifier active until those tokens expire or deploy a dual-key
verification window.

Refresh tokens are opaque server-side sessions and are independent from the
access-token signing algorithm.
