# KYC liveness model runtime

The liveness service is fail-closed. `/health` proves the process is alive, while `/ready` returns HTTP 200 only after at least one anti-spoof ONNX model has loaded successfully.

## Development

The canonical development launchers automatically provision the pinned anti-spoof models when the `kyc` profile is requested:

```powershell
.\up.ps1 -Profile kyc -Build
```

```bash
./up.sh --profile kyc --build
```

The model root comes from `LIVENESS_MODELS_PATH` and defaults to:

```text
.runtime/models/liveness/
  anti_spoof_models/
    2.7_80x80_MiniFASNetV2.onnx
    4_0_0_80x80_MiniFASNetV1SE.onnx
```

The files are not committed. `.runtime/` remains ignored because these are runtime assets rather than source code.

Provisioning can also be run explicitly:

```powershell
python scripts/config/provision_kyc_models.py --env-file .env.development
```

```bash
python3 scripts/config/provision_kyc_models.py --env-file .env.development
```

The provisioner pins the upstream repository commit and verifies SHA-256 before atomically installing each model. A checksum mismatch is fatal.

## Pinned anti-spoof model source

Upstream implementation:

```text
QingHeYang/Silent-Face-Anti-Spoofing-onnx
commit 584d4421d7ac42c59e640796f46e886b0095367a
```

Pinned files:

| Model | SHA-256 |
| --- | --- |
| `2.7_80x80_MiniFASNetV2.onnx` | `0cbe5caec95c31de9d2ef845cb85407d76aecd1b6a2c0e343f7d35306bfbccb8` |
| `4_0_0_80x80_MiniFASNetV1SE.onnx` | `a25886a85cdcfa2c4ea23edb71de35f250c17827b4cadd253a972b28c80fdf1e` |

The upstream repository describes the models as an ONNX conversion of Silent-Face-Anti-Spoofing, with three output classes: paper photo, real face, and screen photo. The real-face class is index 1. The reference inference path uses float32 BGR input in the original 0..255 range, so the liveness container explicitly sets `LIVENESS_INPUT_SCALE=1.0` for this pinned model family.

## Staging and production

Staging and production launchers do **not** auto-download KYC models. Provision the directory referenced by `LIVENESS_MODELS_PATH` before deployment. The runtime contract rejects the KYC profile if no `anti_spoof_models/*.onnx` file is present.

Do not weaken the liveness healthcheck to work around missing models. An empty or invalid model directory must keep `/ready` non-200 so KYC cannot silently fall back to heuristics.

## Diagnostics

Windows PowerShell:

```powershell
Get-ChildItem .\.runtime\models\liveness\anti_spoof_models -Filter *.onnx

docker compose `
  --env-file .env.development `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  --profile kyc ps liveness_service

docker compose `
  --env-file .env.development `
  -f docker-compose.yml `
  -f docker-compose.dev.yml `
  --profile kyc logs --tail 100 liveness_service
```

A healthy startup should report `runtime state=ready` with one or more model names, and `/ready` should return HTTP 200.
