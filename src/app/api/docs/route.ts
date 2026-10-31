import { env } from '~/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Versi dipin supaya tampilan tidak berubah diam-diam saat Scalar rilis versi baru.
const SCALAR_CDN = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.66.1';

/**
 * Scalar API reference over the generated OpenAPI document.
 *
 * Regenerate the spec with `npm run docs:api`, then open /api/docs.
 * Dev-only, mirroring /api/panel.
 */
export function GET() {
  if (env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Anmategra API</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR_CDN}"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/api/docs/openapi.json',
        // tRPC groups by router, so the sidebar is only readable when tags stay collapsed.
        defaultOpenAllTags: false,
      })
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
