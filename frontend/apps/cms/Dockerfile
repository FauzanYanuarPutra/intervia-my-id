ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS cms_deps

ARG NPM_REGISTRY

WORKDIR /app/apps/cms

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

COPY apps/cms/package*.json ./

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

COPY apps/cms/ ./

RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1

FROM cms_deps AS cms_builder

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN npm prune --omit=dev --legacy-peer-deps
RUN rm -rf .next/cache /root/.npm /tmp/*

FROM cms_deps AS cms_dev

FROM node:20-bullseye-slim AS cms

WORKDIR /app/apps/cms

ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=cms_builder /app/apps/cms/.next ./.next
COPY --from=cms_builder /app/apps/cms/public ./public
COPY --from=cms_builder /app/apps/cms/package*.json ./
COPY --from=cms_builder /app/apps/cms/node_modules ./node_modules

# Dibutuhkan apabila npm menyimpan local file dependency sebagai symlink.
COPY --from=cms_builder /app/packages /app/packages

EXPOSE 3001

CMD ["npm", "start"]