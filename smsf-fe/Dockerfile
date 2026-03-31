FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN if [ -f .env ]; then echo ".env file found, building with env vars..."; else echo ".env file NOT found"; fi

ENV NEXT_PUBLIC_API_BASE_URL=/api/v1
ENV NEXT_PUBLIC_LOG_LEVEL=debug

RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3033
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3033

CMD ["node", "server.js"]