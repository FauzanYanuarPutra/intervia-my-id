ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS www_deps

ARG NPM_REGISTRY
ARG NEXT_PUBLIC_APP_ENV=development
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_WWW_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_MARKETPLACE_URL=http://localhost:8081
ARG NEXT_PUBLIC_COMMUNITY_URL=http://localhost:8082
ARG NEXT_PUBLIC_CHAT_WS_URL=ws://localhost:4000/socket
ARG NEXT_PUBLIC_MARKETPLACE_WS_URL=
ARG NEXT_PUBLIC_NOTIFICATION_WS_URL=
ARG NEXT_PUBLIC_LOGIN_OTP_REQUIRED=true
ARG NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED=false
ARG NEXT_PUBLIC_DISABLE_PWA=true
ARG NEXT_PUBLIC_CAPTCHA_PROVIDER=turnstile
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ARG NEXT_PUBLIC_HCAPTCHA_SITE_KEY=
ARG NEXT_PUBLIC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
ARG NEXT_PUBLIC_TURN_URLS=

ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_WWW_URL=${NEXT_PUBLIC_WWW_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_MARKETPLACE_URL=${NEXT_PUBLIC_MARKETPLACE_URL}
ENV NEXT_PUBLIC_COMMUNITY_URL=${NEXT_PUBLIC_COMMUNITY_URL}
ENV NEXT_PUBLIC_CHAT_WS_URL=${NEXT_PUBLIC_CHAT_WS_URL}
ENV NEXT_PUBLIC_MARKETPLACE_WS_URL=${NEXT_PUBLIC_MARKETPLACE_WS_URL}
ENV NEXT_PUBLIC_NOTIFICATION_WS_URL=${NEXT_PUBLIC_NOTIFICATION_WS_URL}
ENV NEXT_PUBLIC_LOGIN_OTP_REQUIRED=${NEXT_PUBLIC_LOGIN_OTP_REQUIRED}
ENV NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED=${NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED}
ENV NEXT_PUBLIC_DISABLE_PWA=${NEXT_PUBLIC_DISABLE_PWA}
ENV NEXT_PUBLIC_CAPTCHA_PROVIDER=${NEXT_PUBLIC_CAPTCHA_PROVIDER}
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
ENV NEXT_PUBLIC_HCAPTCHA_SITE_KEY=${NEXT_PUBLIC_HCAPTCHA_SITE_KEY}
ENV NEXT_PUBLIC_STUN_URLS=${NEXT_PUBLIC_STUN_URLS}
ENV NEXT_PUBLIC_TURN_URLS=${NEXT_PUBLIC_TURN_URLS}

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

# Next standalone intentionally excludes static/public assets. Place them beside
# the generated server so the production image can use the supported entrypoint.
RUN mkdir -p .next/standalone/apps/www/.next \
    && cp -R .next/static .next/standalone/apps/www/.next/static \
    && cp -R public .next/standalone/apps/www/public

RUN npm prune --omit=dev --legacy-peer-deps

RUN rm -rf .next/cache /root/.npm /tmp/*

FROM www_deps AS www_dev

FROM www_builder AS www

WORKDIR /app/apps/www

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN node -e "JSON.parse(require('fs').readFileSync('.next/server/middleware-manifest.json', 'utf8'))" \
    && test -f .next/standalone/apps/www/server.js \
    && test -d .next/standalone/apps/www/.next/static \
    && test -d .next/standalone/apps/www/public

EXPOSE 3000

CMD ["node", ".next/standalone/apps/www/server.js"]
