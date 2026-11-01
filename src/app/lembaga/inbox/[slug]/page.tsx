import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';

import InboxDetailContent from '../_components/inbox-detail-content';

export default async function InboxPageWithParams(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerAuthSession();
  const isLembagaRequest = params.slug === session?.user?.lembagaId;

  let associationRequestEntries;
  if (isLembagaRequest) {
    const res = await api.lembaga.getAllRequestAssociationLembaga({});
    associationRequestEntries = res.requests;
  } else {
    associationRequestEntries = await api.lembaga.getAllRequestAssociation({event_id: params.slug });
  }

  const id = params.slug;
  return <InboxDetailContent id={id} data={associationRequestEntries} lembagaId={session?.user?.lembagaId} isLembagaRequest={isLembagaRequest} />;
}
