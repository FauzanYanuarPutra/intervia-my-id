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

COPY services/marketplace_service/Cargo.toml ./
COPY services/marketplace_service/Cargo.lock* ./

RUN mkdir -p src && \
    printf "fn main() {}\n" > src/main.rs

RUN for i in 1 2 3 4 5; do \
    cargo fetch && break || \
    (echo "cargo fetch failed, retry $i/5" && sleep 8); \
    done

RUN cargo build --release --locked || true

COPY services/marketplace_service/ ./
COPY config/lajukan_data_source_registry.json /config/lajukan_data_source_registry.json

RUN if [ ! -d migrations ]; then \
    mkdir -p migrations && touch migrations/.keep; \
    fi

# SQLx uses the numeric filename prefix as the migration identity. Validate all
# forward migrations here so two different migrations can never share a version
# and make the one-shot migration service fail deterministically at build time.
RUN set -eu; \
    duplicate_versions="$(find migrations -maxdepth 1 -type f -name '*.sql' ! -name '*.down.sql' -printf '%f\n' \
      | awk -F_ '{print $1}' \
      | sort \
      | uniq -d)"; \
    if [ -n "$duplicate_versions" ]; then \
      echo "ERROR: duplicate marketplace SQLx migration version(s):"; \
      printf '%s\n' "$duplicate_versions"; \
      echo "Each forward migration version must be unique."; \
      exit 1; \
    fi

RUN find src -type f -name '*.rs' -exec touch {} +

RUN cargo build --release --locked

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
