ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS crm_deps

ARG NPM_REGISTRY

WORKDIR /app/apps/crm

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm config set maxsockets 15 \
    && npm config set prefer-offline true

COPY packages /app/packages

RUN set -eux; \
    cd /app/packages; \
    if [ -f package-lock.json ]; then \
      npm ci --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    else \
      npm install --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    fi; \
    ./node_modules/.bin/tsc -p tsconfig.build.json

COPY apps/crm/package*.json ./

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

COPY apps/crm/ ./

RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1

FROM crm_deps AS crm_builder

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN npm prune --omit=dev --legacy-peer-deps
RUN rm -rf .next/cache /root/.npm /tmp/*

FROM crm_deps AS crm_dev

FROM node:20-bullseye-slim AS crm

WORKDIR /app/apps/crm

ENV NODE_ENV=production
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=crm_builder /app/apps/crm/.next ./.next
COPY --from=crm_builder /app/apps/crm/public ./public
COPY --from=crm_builder /app/apps/crm/package*.json ./
COPY --from=crm_builder /app/apps/crm/node_modules ./node_modules

COPY --from=crm_builder /app/packages /app/packages

EXPOSE 3002

CMD ["npm", "start"]