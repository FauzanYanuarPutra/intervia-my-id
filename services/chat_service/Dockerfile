# ==========================================
# STAGE 1: BUILDER (Lingkungan Kompilasi)
# ==========================================
FROM elixir:1.15-slim AS builder

# Set environment untuk produksi
ENV MIX_ENV=prod \
    LANG=C.UTF-8 \
    MIX_HTTP_TIMEOUT=120000 \
    HEX_HTTP_TIMEOUT=120000 \
    HEX_HTTP_CONCURRENCY=1

WORKDIR /app

# 1. Install dependencies OS yang dibutuhkan untuk compile
RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && \
    apt-get install -y --no-install-recommends build-essential git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 2. Install Hex & Rebar
RUN sh -eux -c '\
      install_hex() { \
        i=1; \
        while [ "$i" -le 5 ]; do \
          mix local.hex --force && return 0; \
          echo "mix local.hex failed, retry $i/5"; \
          sleep $((i * 10)); \
          i=$((i + 1)); \
        done; \
        i=1; \
        while [ "$i" -le 3 ]; do \
          mix archive.install github hexpm/hex branch latest --force && return 0; \
          echo "mix archive.install github hexpm/hex failed, retry $i/3"; \
          sleep $((i * 15)); \
          i=$((i + 1)); \
        done; \
        return 1; \
      }; \
      install_rebar() { \
        i=1; \
        while [ "$i" -le 5 ]; do \
          mix local.rebar --force && return 0; \
          echo "mix local.rebar failed, retry $i/5"; \
          sleep $((i * 10)); \
          i=$((i + 1)); \
        done; \
        return 1; \
      }; \
      install_hex; \
      install_rebar'

# 3. Copy Mix files & Download Dependencies
# Dilakukan lebih awal agar Docker bisa cache layer 'deps' jika mix.exs tidak berubah
COPY mix.exs mix.lock ./
RUN sh -c '\
    for i in 1 2 3 4 5; do \
      mix deps.get --only prod && exit 0; \
      echo "mix deps.get failed, retry $i/5"; \
      sleep 8; \
    done; \
    exit 1'

# 4. Copy Source Code
# PENTING: Pastikan folder _build dan deps di Windows sudah dihapus agar tidak bentrok
COPY lib lib
COPY priv priv
COPY config config

# 5. Kompilasi Paksa (Clean & Compile)
# --force memastikan semua module (Endpoint & RoomChannel) dikompilasi ulang dengan kode terbaru
RUN mix deps.compile
RUN mix compile --force

# 6. Build Release
# --overwrite memastikan hasil release lama ditimpa dengan yang baru
RUN mix release chat_service --overwrite

# ==========================================
# STAGE 1.5: DEV (Hot Reload)
# ==========================================
FROM elixir:1.15-slim AS chat_service_dev

ENV MIX_ENV=dev \
    LANG=C.UTF-8 \
    MIX_HTTP_TIMEOUT=120000 \
    HEX_HTTP_TIMEOUT=120000 \
    HEX_HTTP_CONCURRENCY=1

WORKDIR /app

RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && \
    apt-get install -y --no-install-recommends build-essential git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN sh -eux -c '\
      install_hex() { \
        i=1; \
        while [ "$i" -le 5 ]; do \
          mix local.hex --force && return 0; \
          echo "mix local.hex failed, retry $i/5"; \
          sleep $((i * 10)); \
          i=$((i + 1)); \
        done; \
        i=1; \
        while [ "$i" -le 3 ]; do \
          mix archive.install github hexpm/hex branch latest --force && return 0; \
          echo "mix archive.install github hexpm/hex failed, retry $i/3"; \
          sleep $((i * 15)); \
          i=$((i + 1)); \
        done; \
        return 1; \
      }; \
      install_rebar() { \
        i=1; \
        while [ "$i" -le 5 ]; do \
          mix local.rebar --force && return 0; \
          echo "mix local.rebar failed, retry $i/5"; \
          sleep $((i * 10)); \
          i=$((i + 1)); \
        done; \
        return 1; \
      }; \
      install_hex; \
      install_rebar'

# ==========================================
# STAGE 2: RUNTIME (Lingkungan Eksekusi)
# ==========================================
FROM erlang:26-slim AS chat_service_runtime

# Install runtime tools (curl untuk healthcheck, bash untuk script release)
RUN apt-get update -o Acquire::Retries=10 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::ForceIPv4=true && \
    apt-get install -y --no-install-recommends curl bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Setup user non-root demi keamanan
RUN useradd -r -m -d /app app_user
WORKDIR /app
RUN chown app_user:app_user /app

USER app_user

# Ambil hasil kompilasi dari stage builder
COPY --from=builder --chown=app_user:app_user /app/_build/prod/rel/chat_service ./

# Env Statis untuk Runtime
ENV HOME=/app \
    MIX_ENV=prod \
    PHX_SERVER=true \
    PORT=4000 \
    ELIXIR_ERL_OPTIONS="+fnu"

# Port aplikasi
EXPOSE 4000

# Jalankan aplikasi menggunakan entrypoint release
CMD ["bin/chat_service", "start"]
