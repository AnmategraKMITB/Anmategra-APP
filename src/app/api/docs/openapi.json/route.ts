import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '~/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves the generated OpenAPI document. Gated the same way as the tRPC panel
 * (`/api/panel`): the spec enumerates every internal endpoint, so it stays off
 * in production even though each endpoint enforces its own access checks.
 */
export async function GET() {
  if (env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  const file = path.join(process.cwd(), 'docs/api/openapi.json');

  try {
    return new Response(await fs.readFile(file, 'utf8'), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json(
      { error: 'openapi.json belum di-generate. Jalankan `npm run docs:api`.' },
      { status: 503 },
    );
  }
}
