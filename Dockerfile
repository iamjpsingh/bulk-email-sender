# =============================================================================
# Dispatch - Multi-stage Docker Build
# Stage 1: Build Vue 3 frontend with Vite
# Stage 2: Production Bun + Hono backend serving the built frontend
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Frontend Build
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS frontend-build

WORKDIR /app/frontend

# Copy dependency manifests first for layer caching
COPY frontend/package.json frontend/bun.lock ./

# Install all dependencies (including devDependencies for build tooling)
RUN bun install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build the Vue 3 SPA (vue-tsc type-check + vite build)
# Output goes to /app/frontend/dist/
RUN bunx vue-tsc -b && bunx vite build

# ---------------------------------------------------------------------------
# Stage 2: Backend Production Image
# ---------------------------------------------------------------------------
FROM oven/bun:1 AS backend

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json bun.lock ./

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# Copy backend source code
COPY src/ ./src/
COPY tsconfig.json ./

# Copy public assets (sample files)
COPY public/samples/ ./public/samples/

# Copy the built frontend from stage 1 into dist/frontend/
# The backend can serve these as static files
COPY --from=frontend-build /app/frontend/dist/ ./dist/frontend/

# Create persistent directories for SQLite databases, logs, and uploads
RUN mkdir -p data logs uploads

# Expose the backend port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Health check against the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# Start the application
CMD ["bun", "run", "src/app.ts"]
