import { type Metadata } from 'next';

import { DocsPage } from '~/app/_components/manual/docs-page';
import { getDocPage } from '~/server/manual/docs';

type Props = { params: Promise<{ slug?: string[] }> };

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
  // Manual terbuka untuk publik; isinya dokumen statis tanpa data pengguna.
  return <DocsPage slug={params.slug ?? []} basePath="/manual" />;
}
