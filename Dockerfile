FROM node:25.0-alpine AS base

WORKDIR /app

RUN npm install -g pnpm

FROM base AS builder
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/.next/ ./.next/
COPY --from=builder /app/public/ ./public/

EXPOSE 3000

CMD ["pnpm", "start"]
