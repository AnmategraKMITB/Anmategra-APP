import { getServerAuthSession } from '~/server/auth';

import InboxView from './_components/inbox-view';

export default async function InboxPage() {
  const session = await getServerAuthSession();
  return <InboxView lembagaId={session?.user?.lembagaId ?? ''} />;
}
