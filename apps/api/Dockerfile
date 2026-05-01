FROM node:20 AS builder
WORKDIR /usr/src/app

# Install deps and build
COPY package*.json tsconfig*.json tsconfig.build.json ./
RUN npm ci
COPY prisma ./prisma
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Prisma engines need OpenSSL available at runtime for migrate/seed commands.
RUN apk add --no-cache openssl

# Install only production deps
COPY --from=builder /usr/src/app/package*.json ./
RUN npm ci --omit=dev

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
