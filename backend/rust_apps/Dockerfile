# --- Stage 1: Builder ---
FROM rustlang/rust:nightly-bookworm AS builder

ENV CARGO_NET_RETRY=20 \
    CARGO_HTTP_TIMEOUT=600 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    CARGO_HTTP_MULTIPLEXING=false \
    SQLX_OFFLINE=true

RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Cache dependency layer dari manifest saja.
# Selama Cargo.toml/Cargo.lock tidak berubah, layer ini reuse.
COPY Cargo.toml Cargo.lock ./
COPY common/Cargo.toml common/Cargo.toml
COPY identity_service/Cargo.toml identity_service/Cargo.toml
COPY marketplace_service/Cargo.toml marketplace_service/Cargo.toml
COPY ai_service/Cargo.toml ai_service/Cargo.toml
COPY community_service/Cargo.toml community_service/Cargo.toml

# Buat source placeholder agar cargo bisa resolve dependency graph workspace.
RUN mkdir -p common/src identity_service/src marketplace_service/src ai_service/src community_service/src && \
    printf "pub fn _build_cache_placeholder() {}\n" > common/src/lib.rs && \
    printf "fn main() {}\n" > identity_service/src/main.rs && \
    printf "fn main() {}\n" > marketplace_service/src/main.rs && \
    printf "fn main() {}\n" > ai_service/src/main.rs && \
    printf "fn main() {}\n" > community_service/src/main.rs

RUN for i in 1 2 3 4 5; do cargo fetch && break || (echo "cargo fetch failed, retry $i/5" && sleep 8); done
RUN cargo build --release --bins

# 2) Copy source asli, lalu compile final binaries.
COPY . .

# Docker COPY bisa membawa timestamp file host yang lebih lama dari placeholder
# yang dibuat sebelumnya. Touch source nyata agar cargo tidak memakai binary
# placeholder lama secara keliru.
RUN find common identity_service marketplace_service ai_service community_service -type f \( -name '*.rs' -o -name 'Cargo.toml' \) -exec touch {} +

# Ensure migration sources exist for all known Rust services so runtime COPY
# won't fail for services without migrations (e.g. ai_service).
RUN for svc in identity_service marketplace_service ai_service community_service; do \
      if ! ls /app/${svc}/migrations* >/dev/null 2>&1; then \
        mkdir -p /app/${svc}/migrations && \
        touch /app/${svc}/migrations/.keep; \
      fi; \
    done

RUN cargo build --release --bins

ARG INSTALL_SQLX=true
RUN if [ "${INSTALL_SQLX}" = "true" ]; then \
      cargo install sqlx-cli --no-default-features --features postgres; \
    else \
      printf '#!/usr/bin/env sh\nexit 0\n' > /usr/local/cargo/bin/sqlx && \
      chmod +x /usr/local/cargo/bin/sqlx; \
    fi

# --- Stage 1.5: Dev ---
FROM rustlang/rust:nightly-bookworm AS dev

ENV CARGO_NET_RETRY=20 \
    CARGO_HTTP_TIMEOUT=600 \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    CARGO_HTTP_MULTIPLEXING=false \
    SQLX_OFFLINE=true

RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    postgresql-client \
    redis-tools \
    curl \
    netcat-openbsd \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN cargo install cargo-watch --locked

ARG INSTALL_SQLX=true
RUN if [ "${INSTALL_SQLX}" = "true" ]; then \
      cargo install sqlx-cli --no-default-features --features postgres; \
    else \
      printf '#!/usr/bin/env sh\nexit 0\n' > /usr/local/cargo/bin/sqlx && \
      chmod +x /usr/local/cargo/bin/sqlx; \
    fi

COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/wait-for-it.sh /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# --- Stage 2: Runtime ---
# Gunakan tetap debian bookworm agar image akhir tetap kecil dan stabil
FROM debian:bookworm-slim AS runtime

RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && apt-get install -y --no-install-recommends \
    libssl3 \
    ca-certificates \
    postgresql-client \
    redis-tools \
    curl \
    netcat-openbsd \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ARG SERVICE_NAME

# Salin binary
COPY --from=builder /app/target/release/${SERVICE_NAME} /usr/local/bin/app_service
COPY --from=builder /usr/local/cargo/bin/sqlx /usr/local/bin/sqlx

# Salin migrations dari folder service.
# Placeholder folder/file sudah dipastikan ada di stage builder.
RUN mkdir -p ./migrations

# Gunakan / di akhir path tujuan
COPY --from=builder /app/${SERVICE_NAME}/migrations* ./migrations/

COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/wait-for-it.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["app_service"]
