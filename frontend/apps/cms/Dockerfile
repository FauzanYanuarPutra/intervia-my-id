ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS cms_deps

ARG NPM_REGISTRY
ARG NEXT_PUBLIC_APP_ENV=development
ARG NEXT_PUBLIC_WWW_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:8081

ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_WWW_URL=${NEXT_PUBLIC_WWW_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

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

FROM cms_deps AS cms_lint
RUN npm run lint && npm run typecheck

FROM cms_deps AS cms_builder
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN mkdir -p .next/standalone/apps/cms/.next \
    && cp -R .next/static .next/standalone/apps/cms/.next/static \
    && cp -R public .next/standalone/apps/cms/public
RUN npm prune --omit=dev --legacy-peer-deps
RUN rm -rf .next/cache /root/.npm /tmp/*

FROM cms_deps AS cms_dev

FROM cms_builder AS cms
WORKDIR /app/apps/cms
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN node -e "JSON.parse(require('fs').readFileSync('.next/server/middleware-manifest.json', 'utf8'))" \
    && test -f .next/standalone/apps/cms/server.js \
    && test -d .next/standalone/apps/cms/.next/static \
    && test -d .next/standalone/apps/cms/public
EXPOSE 3001
CMD ["node", ".next/standalone/apps/cms/server.js"]
