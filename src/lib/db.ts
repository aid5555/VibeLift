import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client bound to the file-based SQLite database.
 *
 * - Reads `DATABASE_URL` directly (with the canonical /data default) so that
 *   importing this module never triggers full env validation of unrelated keys
 *   (which would break static builds and tests).
 * - Uses a `globalThis` cache to survive Next.js hot reload without leaking
 *   connections in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:/data/vibelift.db';
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
