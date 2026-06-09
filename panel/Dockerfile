# ---- deps: install + compile native modules ----
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* .npmrc* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile
# Ensure native addons are actually compiled (build-script approval can be
# skipped by the package manager in CI/containers).
RUN pnpm rebuild better-sqlite3 \
 && test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node

# ---- builder: build Next standalone ----
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner: minimal runtime ----
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Standalone server output + static assets + our custom server/ws.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Custom server + WS run outside Next's bundler, so copy node_modules subset
# they need (dockerode, ws, jose). Standalone already traced most; copy full
# node_modules to be safe for the custom server.js requires.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/ws-server.js ./ws-server.js

EXPOSE 3000
CMD ["node", "server.js"]
