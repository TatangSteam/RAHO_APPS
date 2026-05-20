FROM node:20 AS builder
WORKDIR /usr/src/web

# Build-time public envs for Next.js. These are injected by compose build.args.
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_APP_NAME="Raho ERP"
ARG NEXT_PUBLIC_APP_VERSION="1.0.0"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/web
ENV NODE_ENV=production

COPY --from=builder /usr/src/web/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/web/.next ./.next
COPY --from=builder /usr/src/web/public ./public

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
