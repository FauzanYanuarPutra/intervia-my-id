ARG NPM_REGISTRY=https://registry.npmjs.org/

FROM node:20-bullseye-slim AS cms_deps

ARG NPM_REGISTRY
ARG NEXT_PUBLIC_APP_ENV=development
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_CMS_URL=http://localhost:3001
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
ENV NEXT_PUBLIC_CMS_URL=${NEXT_PUBLIC_CMS_URL}
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
      if ! npm ci --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; then \
        echo "package-lock.json is stale or incompatible; falling back to npm install"; \
        rm -rf node_modules; \
        retry_npm npm install --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
      fi; \
    else \
      retry_npm npm install --legacy-peer-deps --include=optional --prefer-offline --no-audit --no-fund; \
    fi; \
    if ! node -e "require.resolve('@next/swc-linux-x64-gnu/package.json')"; then \
      NEXT_VERSION=$(node -p "require('./node_modules/next/package.json').version"); \
      retry_npm npm install --no-save --legacy-peer-deps --prefer-offline --no-audit --no-fund "@next/swc-linux-x64-gnu@${NEXT_VERSION}"; \
    fi

COPY apps/cms/ ./
RUN mkdir -p public

ENV NEXT_TELEMETRY_DISABLED=1
ENV FAST_DOCKER_BUILD=true

FROM cms_deps AS cms_test
RUN npm run test --if-present

FROM cms_deps AS cms_lint
RUN npm run lint && npm run typecheck

FROM cms_deps AS cms_builder
RUN if [ -d "/app/apps/cms/next-env.d.ts" ]; then rm -rf "/app/apps/cms/next-env.d.ts"; fi
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build
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
