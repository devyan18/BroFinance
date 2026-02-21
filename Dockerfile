# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml .npmrc ./

# Install all dependencies (dev included for esbuild)
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript → CommonJS bundle (all local code inlined, node_modules external)
RUN pnpm build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests and install production deps only
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled bundle
COPY --from=builder /app/dist ./dist

# Directory for uploaded avatars (bind-mount or volume in production)
RUN mkdir -p uploads

EXPOSE 4000

# Env vars are injected by the container orchestrator (Docker Compose / cloud platform)
CMD ["node", "dist/app.js"]
