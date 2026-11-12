import InboxView from '~/app/lembaga/inbox/_components/inbox-view';

import { requireManagedLembaga } from '../../_lib/require-lembaga';

const ManageInboxPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  await requireManagedLembaga(lembagaId);
  return (
    <InboxView lembagaId={lembagaId} basePath={`/manage/${lembagaId}/inbox`} />
  );
};

export default ManageInboxPage;
