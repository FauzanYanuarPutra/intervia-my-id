# ==============================
# CRM BUILD STAGE
# ==============================
ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS crm_deps

ARG NPM_REGISTRY

WORKDIR /app/crm

RUN npm config set registry "${NPM_REGISTRY}" \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 600000 \
    && npm config set maxsockets 15 \
    && npm config set prefer-offline true

COPY shared /app/shared
COPY crm/package*.json ./

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
RUN cd /app/shared && ./node_modules/.bin/tsc -p tsconfig.build.json

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
      echo "Installing missing Linux SWC package for Next ${NEXT_VERSION}"; \
      retry_npm npm install --no-save --legacy-peer-deps --prefer-offline --no-audit --no-fund "@next/swc-linux-x64-gnu@${NEXT_VERSION}"; \
    fi

COPY crm/ .
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1

FROM crm_deps AS crm_builder

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build
RUN npm prune --omit=dev

FROM crm_deps AS crm_dev

# ==============================
# CRM RUNTIME STAGE
# ==============================
FROM node:20-bullseye-slim AS crm

WORKDIR /app/crm

ENV NODE_ENV=${NODE_ENV}
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=crm_builder /app/crm/.next ./.next
COPY --from=crm_builder /app/crm/public ./public
COPY --from=crm_builder /app/crm/package*.json ./
COPY --from=crm_builder /app/crm/node_modules ./node_modules

EXPOSE 3002

CMD ["npm", "start"]
