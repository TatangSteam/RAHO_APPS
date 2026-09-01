FROM node:20 AS builder
WORKDIR /usr/src/app

# TypeScript compiles a large API module graph. Keep this setting scoped to
# the builder stage so CI has enough V8 heap without increasing runtime memory.
ARG NODE_BUILD_MEMORY_MB=3072
ENV NODE_OPTIONS=--max-old-space-size=${NODE_BUILD_MEMORY_MB}
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

# Install deps and build
COPY package*.json tsconfig*.json tsconfig.build.json ./
RUN --mount=type=cache,id=raho-api-npm,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline
COPY prisma ./prisma
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

# Prisma engines need OpenSSL available at runtime for migrate/seed commands.
RUN apk add --no-cache openssl

# Install only production deps
COPY --from=builder /usr/src/app/package*.json ./
RUN --mount=type=cache,id=raho-api-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --prefer-offline

# Copy generated Prisma client from builder (ensures @prisma/client is present)
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Copy build output and prisma client
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Entrypoint for loading secrets
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
