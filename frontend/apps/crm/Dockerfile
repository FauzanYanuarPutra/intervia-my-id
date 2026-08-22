ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS crm_deps

ARG NPM_REGISTRY
ARG NEXT_PUBLIC_APP_ENV=development
ARG NEXT_PUBLIC_API_URL=http://localhost:8081
ARG NEXT_PUBLIC_IDENTITY_API_URL=/api/identity
ARG NEXT_PUBLIC_WWW_URL=http://localhost:3000
ARG NEXT_PUBLIC_CRM_URL=http://localhost:3002
ARG NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:8081
ARG NEXT_PUBLIC_USAHA_URL=http://localhost:3003

ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_IDENTITY_API_URL=${NEXT_PUBLIC_IDENTITY_API_URL}
ENV NEXT_PUBLIC_WWW_URL=${NEXT_PUBLIC_WWW_URL}
ENV NEXT_PUBLIC_CRM_URL=${NEXT_PUBLIC_CRM_URL}
ENV NEXT_PUBLIC_MARKETPLACE_URL=${NEXT_PUBLIC_MARKETPLACE_URL}
ENV NEXT_PUBLIC_USAHA_URL=${NEXT_PUBLIC_USAHA_URL}

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

FROM crm_deps AS crm_lint
RUN npm run lint && npm run typecheck

FROM crm_deps AS crm_builder
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN mkdir -p .next/standalone/apps/crm/.next \
    && cp -R .next/static .next/standalone/apps/crm/.next/static \
    && cp -R public .next/standalone/apps/crm/public
RUN npm prune --omit=dev --legacy-peer-deps
RUN rm -rf .next/cache /root/.npm /tmp/*

FROM crm_deps AS crm_dev

FROM crm_builder AS crm
WORKDIR /app/apps/crm
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN node -e "JSON.parse(require('fs').readFileSync('.next/server/middleware-manifest.json', 'utf8'))" \
    && test -f .next/standalone/apps/crm/server.js \
    && test -d .next/standalone/apps/crm/.next/static \
    && test -d .next/standalone/apps/crm/public
EXPOSE 3002
CMD ["node", ".next/standalone/apps/crm/server.js"]
