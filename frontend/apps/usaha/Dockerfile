ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS usaha_deps

ARG NPM_REGISTRY

WORKDIR /app/apps/usaha

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm config set maxsockets 15 \
    && npm config set prefer-offline true

COPY apps/usaha/package*.json ./

RUN set -eux; \
    retry_npm() { \
      attempt=1; \
      while [ "$attempt" -le 5 ]; do \
        "$@" && return 0; \
        echo "npm command failed, retry ${attempt}/5"; \
        npm cache verify || true; \
        sleep $((attempt * 10)); \
        attempt=$((attempt + 1)); \
      done; \
      return 1; \
    }; \
    if [ -f package-lock.json ]; then \
      retry_npm npm ci --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
    else \
      retry_npm npm install --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
    fi; \
    if ! node -e "require.resolve('@next/swc-linux-x64-gnu/package.json')"; then \
      NEXT_VERSION=$(node -p "require('./node_modules/next/package.json').version"); \
      retry_npm npm install \
        --no-save \
        --legacy-peer-deps \
        --prefer-offline \
        --no-audit \
        --no-fund \
        "@next/swc-linux-x64-gnu@${NEXT_VERSION}"; \
    fi

COPY apps/usaha/ ./

RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1

FROM usaha_deps AS usaha_builder

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build
RUN npm prune --omit=dev --legacy-peer-deps
RUN rm -rf .next/cache /root/.npm /tmp/*

FROM usaha_deps AS usaha_dev

FROM node:20-bullseye-slim AS usaha

WORKDIR /app/apps/usaha

ENV NODE_ENV=production
ENV PORT=3003
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=usaha_builder /app/apps/usaha/.next ./.next
COPY --from=usaha_builder /app/apps/usaha/public ./public
COPY --from=usaha_builder /app/apps/usaha/package*.json ./
COPY --from=usaha_builder /app/apps/usaha/node_modules ./node_modules

EXPOSE 3003

CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3003"]