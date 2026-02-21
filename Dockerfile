# ── Stage 1: Production dependencies (with native build tools for bcrypt) ─────
FROM node:20-alpine AS deps

WORKDIR /app

# Build tools required by bcrypt's native bindings
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# ── Stage 2: Build (TypeScript → JS bundle) ───────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy pre-compiled production node_modules (bcrypt already compiled for this arch)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copy JS bundle
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/app.js"]
