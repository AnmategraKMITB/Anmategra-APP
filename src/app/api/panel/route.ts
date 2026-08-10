import { renderTrpcPanel } from '@metamorph/trpc-panel';
import { appRouter } from '~/server/api/root';
import { env } from '~/env';

export async function GET() {
  if (env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(
    renderTrpcPanel(appRouter, {
      url: `${env.NEXT_PUBLIC_BASE_URL}/api/trpc`,
      transformer: 'superjson',
    }),
    {
      status: 200,
      headers: [['Content-Type', 'text/html']],
    },
  );
}
