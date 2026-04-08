FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json bun.lock* ./

# Install ALL dependencies (including devDependencies needed for build)
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build SvelteKit static bundle into /app/build
RUN bun run build

# Production image — smaller, only runtime needed
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy the built static files and server source
COPY --from=builder /app/build ./build
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

# Install only production dependencies (server has none currently, but future-proof)
RUN bun install --production --frozen-lockfile 2>/dev/null || bun install --production

# Railway injects PORT at runtime; default 3000 for local
ENV PORT=3000

EXPOSE $PORT

# Entry point: Bun runs the WebSocket + static file server
CMD ["bun", "run", "server/index.ts"]
