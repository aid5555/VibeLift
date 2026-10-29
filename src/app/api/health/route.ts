import { ok } from '@/lib/response';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return ok({ status: 'ok', timestamp: new Date().toISOString() });
}
