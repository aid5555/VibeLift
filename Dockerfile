# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
# VibeLift — single self-contained container
# Next.js (App Router) + embedded SQLite (Prisma). No external DB containers.
# -----------------------------------------------------------------------------

# ---------- Stage 1: dependencies ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy manifests + Prisma schema first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install all dependencies (includes prisma CLI + @prisma/client, whose
# postinstall generates the client against prisma/schema.prisma).
RUN npm ci

# ---------- Stage 2: builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the Prisma client is generated for the current schema, then build.
RUN npx prisma generate
RUN npm run build

# ---------- Stage 3: runner (production) ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl su-exec
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Non-root user for the runtime process.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Build artifacts + runtime files.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Reinstall production-only deps (prisma is intentionally a runtime dependency so
# `prisma migrate deploy` can run at startup). Schema is present for postinstall.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Startup script + writable data directory for SQLite and photos.
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /data/photos && chown -R nextjs:nodejs /data

# The entrypoint starts as root, ensures /data is writable by `nextjs`, then
# drops privileges with su-exec before launching the server. This keeps bind
# mounts (docker-compose) working regardless of host directory ownership.

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
