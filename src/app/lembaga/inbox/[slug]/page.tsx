import { getServerAuthSession } from '~/server/auth';

import InboxDetailView from '../_components/inbox-detail-view';

export default async function InboxPageWithParams(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const session = await getServerAuthSession();
  return (
    <InboxDetailView lembagaId={session?.user?.lembagaId ?? ''} slug={slug} />
  );
}
