import { redirect } from 'next/navigation';
import { type Metadata } from 'next';

import { DocsPage } from '~/app/_components/manual/docs-page';
import { getServerAuthSession } from '~/server/auth';
import { getDocPage } from '~/server/manual/docs';

type Props = { params: Promise<{ slug?: string[] }> };

// Authentication is request-specific, so keep the manual out of the public
// static cache. Middleware performs the first access check; this is defense in
// depth for direct server-component renders.
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const page = await getDocPage(params.slug ?? []);
  const slug = params.slug ?? [];
  const canonical = slug.length === 0 ? '/manual' : `/manual/${slug.join('/')}`;

  if (!page) return { title: 'Manual' };

  return {
    title: page.meta.title,
    alternates: { canonical },
  };
}

export default async function ManualPage(props: Props) {
  const params = await props.params;
  const session = await getServerAuthSession();
  if (!session) redirect('/authentication');

  return <DocsPage slug={params.slug ?? []} basePath="/manual" />;
}
