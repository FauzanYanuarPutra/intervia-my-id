ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS www_deps

ARG NPM_REGISTRY

WORKDIR /app/www

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm config set maxsockets 15 \
    && npm config set prefer-offline true

COPY shared /app/shared
COPY www/package*.json ./

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
    cd /app/shared; \
    if [ -f package-lock.json ]; then \
      retry_npm npm ci --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    else \
      retry_npm npm install --legacy-peer-deps --include=dev --prefer-offline --no-audit --no-fund; \
    fi

# Use legacy peer deps to keep compatibility with React 19 + older peer ranges
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
      echo "Using npm ci"; \
      retry_npm npm ci --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
    else \
      echo "package-lock.json not found, running npm install"; \
      retry_npm npm install --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
    fi; \
    if ! node -e "require.resolve('@next/swc-linux-x64-gnu/package.json')"; then \
      NEXT_VERSION=$(node -p "require('./node_modules/next/package.json').version"); \
      echo "Installing missing Linux SWC package for Next ${NEXT_VERSION}"; \
      retry_npm npm install --no-save --legacy-peer-deps --prefer-offline --no-audit --no-fund "@next/swc-linux-x64-gnu@${NEXT_VERSION}"; \
    fi

RUN cd /app/shared && ./node_modules/.bin/tsc -p tsconfig.build.json

COPY www/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV FAST_DOCKER_BUILD=true

FROM www_deps AS www_builder

# next-env.d.ts wajib berupa file, bukan directory.
# Hapus directory rusak jika pernah ikut tercopy dari host.
RUN if [ -d "/app/www/next-env.d.ts" ]; then \
      echo "WARNING: next-env.d.ts was a directory; removing it"; \
      rm -rf "/app/www/next-env.d.ts"; \
    fi

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

RUN npm prune --omit=dev --legacy-peer-deps

RUN rm -rf .next/cache /root/.npm /tmp/*

FROM www_deps AS www_dev

FROM www_builder AS www

WORKDIR /app/www

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN node -e "JSON.parse(require('fs').readFileSync('.next/server/middleware-manifest.json', 'utf8')); require.resolve('next/dist/bin/next')"

EXPOSE 3000

CMD ["npm", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
