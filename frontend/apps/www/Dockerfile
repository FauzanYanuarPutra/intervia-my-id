ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS www_deps

ARG NPM_REGISTRY

WORKDIR /app/apps/www

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm config set maxsockets 15 \
    && npm config set prefer-offline true

# Shared frontend package.
# Build context adalah ./frontend, sehingga "packages" berarti frontend/packages.
COPY packages /app/packages

RUN set -eux; \
    cd /app/packages; \
    if [ -f package-lock.json ]; then \
      npm ci --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    else \
      npm install --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    fi; \
    ./node_modules/.bin/tsc -p tsconfig.build.json

# Copy manifest terlebih dahulu agar Docker dependency layer bisa dicache.
COPY apps/www/package*.json ./

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

COPY apps/www/ ./

ENV NEXT_TELEMETRY_DISABLED=1
ENV FAST_DOCKER_BUILD=true

FROM www_deps AS www_test

RUN npm run test

FROM www_deps AS www_lint

RUN npm run lint

FROM www_deps AS www_builder

RUN if [ -d "/app/apps/www/next-env.d.ts" ]; then \
      echo "WARNING: next-env.d.ts was a directory; removing it"; \
      rm -rf "/app/apps/www/next-env.d.ts"; \
    fi

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

RUN npm prune --omit=dev --legacy-peer-deps

RUN rm -rf .next/cache /root/.npm /tmp/*

FROM www_deps AS www_dev

FROM www_builder AS www

WORKDIR /app/apps/www

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN node -e "JSON.parse(require('fs').readFileSync('.next/server/middleware-manifest.json', 'utf8')); require.resolve('next/dist/bin/next')"

EXPOSE 3000

CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
