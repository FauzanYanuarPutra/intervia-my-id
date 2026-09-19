FROM rust:1.97.1-bookworm AS builder
ENV CARGO_NET_RETRY=20 CARGO_HTTP_TIMEOUT=600 CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse SQLX_OFFLINE=true
WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && printf "fn main() {}\n" > src/main.rs
RUN cargo fetch && cargo build --release --locked || true
COPY . .
RUN find src -type f -name '*.rs' -exec touch {} +
RUN cargo build --release --locked
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/promotion_service /usr/local/bin/app_service
EXPOSE 8096
CMD ["app_service"]
