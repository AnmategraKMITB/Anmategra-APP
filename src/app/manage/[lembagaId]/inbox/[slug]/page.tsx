import InboxDetailView from '~/app/lembaga/inbox/_components/inbox-detail-view';

import { requireManagedLembaga } from '../../../_lib/require-lembaga';

const ManageInboxDetailPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; slug: string }>;
}) => {
  const { lembagaId, slug } = await params;
  await requireManagedLembaga(lembagaId);
  return (
    <InboxDetailView
      lembagaId={lembagaId}
      slug={slug}
      basePath={`/manage/${lembagaId}/inbox`}
    />
  );
};

export default ManageInboxDetailPage;
