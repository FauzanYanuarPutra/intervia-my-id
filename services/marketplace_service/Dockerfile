# --- Stage 1: Builder ---
FROM rustlang/rust:nightly-bookworm AS builder

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

RUN cargo build --release || true

COPY . .

RUN if [ ! -d migrations ]; then \
    mkdir -p migrations && touch migrations/.keep; \
    fi

RUN find src -type f -name '*.rs' -exec touch {} +

RUN cargo build --release

ARG INSTALL_SQLX=true
RUN if [ "${INSTALL_SQLX}" = "true" ]; then \
    cargo install sqlx-cli --no-default-features --features postgres; \
    fi

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
    curl \
    postgresql-client \
    redis-tools \
    bash && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/marketplace_service /usr/local/bin/app_service

COPY --from=builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx

RUN mkdir -p migrations

COPY --from=builder /app/migrations/ ./migrations/

EXPOSE 8081

CMD ["app_service"]