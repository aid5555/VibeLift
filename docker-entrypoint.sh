#!/bin/sh
set -e

# The container starts as root so it can guarantee the mounted /data volume is
# writable by the unprivileged app user, then drops privileges for everything else.
mkdir -p /data/photos
chown -R nextjs:nodejs /data

echo "[vibelift] Applying Prisma migrations..."
su-exec nextjs ./node_modules/.bin/prisma migrate deploy

echo "[vibelift] Starting Next.js server on port ${PORT:-3000}..."
exec su-exec nextjs ./node_modules/.bin/next start -p "${PORT:-3000}"
