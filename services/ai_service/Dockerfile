# syntax=docker/dockerfile:1.7

# =========================================================
# Lajukan AI Service
# Rust AI Orchestrator
# =========================================================

# ---------------------------------------------------------
# Stage 1: Builder
# ---------------------------------------------------------
FROM rust:1-bookworm AS builder

ENV CARGO_NET_RETRY=10 \
    CARGO_HTTP_TIMEOUT=600 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    CARGO_HTTP_MULTIPLEXING=true

RUN apt-get update \
    -o Acquire::Retries=5 \
    -o Acquire::ForceIPv4=true \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------
# Dependency caching
# ---------------------------------------------------------

COPY Cargo.toml ./

# Dummy source agar dependency bisa dicache Docker.
RUN mkdir -p src \
    && printf 'fn main() {}\n' > src/main.rs

RUN cargo build --release || true

# ---------------------------------------------------------
# Actual application
# ---------------------------------------------------------

COPY src ./src

# Jika nanti ada file/module tambahan di root,
# tambahkan COPY di sini.
#
# Contoh:
# COPY prompts ./prompts

RUN touch src/main.rs \
    && cargo build --release \
    && strip target/release/ai_service

# ---------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------
FROM debian:bookworm-slim AS runtime

ENV PORT=8080 \
    RUST_LOG=info

RUN apt-get update \
    -o Acquire::Retries=5 \
    -o Acquire::ForceIPv4=true \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder \
    /app/target/release/ai_service \
    /usr/local/bin/ai_service

COPY docker-entrypoint.sh \
    /usr/local/bin/docker-entrypoint.sh

# Windows dapat menyimpan shell script dengan CRLF.
# Normalisasi agar tidak terjadi /bin/sh^M error.
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

HEALTHCHECK \
    --interval=15s \
    --timeout=5s \
    --start-period=10s \
    --retries=5 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["/usr/local/bin/ai_service"]