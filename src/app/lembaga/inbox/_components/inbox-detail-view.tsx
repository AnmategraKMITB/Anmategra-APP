import { api } from '~/trpc/server';

import InboxDetailContent from './inbox-detail-content';

/** Detail permintaan asosiasi (lembaga atau satu kegiatan) milik `lembagaId`. */
export default async function InboxDetailView({
  lembagaId,
  slug,
  basePath,
}: {
  lembagaId: string;
  slug: string;
  basePath?: string;
}) {
  const isLembagaRequest = slug === lembagaId;

  const data = isLembagaRequest
    ? (await api.lembaga.getAllRequestAssociationLembaga({ lembagaId }))
        .requests
    : await api.lembaga.getAllRequestAssociation({
        lembagaId,
        event_id: slug,
      });

  return (
    <InboxDetailContent
      id={slug}
      data={data}
      lembagaId={lembagaId}
      isLembagaRequest={isLembagaRequest}
      basePath={basePath}
    />
  );
}
