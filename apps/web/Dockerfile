# syntax=docker/dockerfile:1.7
FROM node:20 AS builder
WORKDIR /usr/src/web

# Keep Next.js build memory predictable on constrained CI hosts. This
# environment variable is not inherited by the production runner stage.
ARG NODE_BUILD_MEMORY_MB=2048
ENV NODE_OPTIONS=--max-old-space-size=${NODE_BUILD_MEMORY_MB}
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

# Build-time public envs for Next.js. These are injected by compose build.args.
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_APP_NAME="Raho ERP"
ARG NEXT_PUBLIC_APP_VERSION="1.0.0"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

COPY package*.json ./
RUN --mount=type=cache,id=raho-web-npm,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline

COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/web
ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

COPY --from=builder /usr/src/web/package*.json ./
RUN --mount=type=cache,id=raho-web-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --prefer-offline

COPY --from=builder /usr/src/web/.next ./.next
COPY --from=builder /usr/src/web/public ./public

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
