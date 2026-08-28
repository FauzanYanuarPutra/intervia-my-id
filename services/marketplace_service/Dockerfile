# --- Stage 1: Builder ---
FROM rust:1.97.1-bookworm AS builder

ENV CARGO_NET_RETRY=20 \
    CARGO_HTTP_TIMEOUT=600 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    CARGO_HTTP_MULTIPLEXING=false \
    SQLX_OFFLINE=true

RUN apt-get update \
    -o Acquire::Retries=10 \
    -o Acquire::http::Timeout=30 \
    -o Acquire::https::Timeout=30 \
    -o Acquire::ForceIPv4=true && \
    apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml ./
COPY Cargo.lock* ./

RUN mkdir -p src && \
    printf "fn main() {}\n" > src/main.rs

RUN for i in 1 2 3 4 5; do \
    cargo fetch && break || \
    (echo "cargo fetch failed, retry $i/5" && sleep 8); \
    done

RUN cargo build --release --locked || true

COPY . .

RUN if [ ! -d migrations ]; then \
    mkdir -p migrations && touch migrations/.keep; \
    fi

RUN find src -type f -name '*.rs' -exec touch {} +

RUN cargo build --release --locked

RUN rustup component add rustfmt clippy

# --- Runtime ---
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    -o Acquire::Retries=10 \
    -o Acquire::http::Timeout=30 \
    -o Acquire::https::Timeout=30 \
    -o Acquire::ForceIPv4=true && \
    apt-get install -y --no-install-recommends \
    libssl3 \
    ca-certificates \
    curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/marketplace_service /usr/local/bin/app_service

EXPOSE 8081

CMD ["app_service"]
