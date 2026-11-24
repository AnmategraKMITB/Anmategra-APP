// Library Import
import { notFound } from 'next/navigation';
// Server Import
import { getDocNav, getDocPage } from '~/server/manual/docs';

// Components Import
import { DocsShell } from './docs-shell';

/**
 * Server component for the manual. Rendered by the single authenticated
 * /manual route (in the (public) group) for all roles. The surrounding chrome
 * adapts to the session in the layout; the documentation content itself is
 * identical for all authenticated viewers.
 */
export async function DocsPage({
  slug = [],
  basePath,
}: {
  slug?: string[];
  basePath: string;
}) {
  const [nav, page] = await Promise.all([getDocNav(), getDocPage(slug)]);

  if (!page) notFound();

  return <DocsShell nav={nav} page={page} basePath={basePath} />;
}
