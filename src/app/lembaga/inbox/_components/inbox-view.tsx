import { api } from '~/trpc/server';

import InboxContent from './inbox-content';

/** Daftar permintaan asosiasi satu lembaga; dipakai Owner dan /manage. */
export default async function InboxView({
  lembagaId,
  basePath,
}: {
  lembagaId: string;
  basePath?: string;
}) {
  const summary = await api.lembaga.getAllRequestAssociationSummary({
    lembagaId,
  });

  const entries = summary.map((item) => ({
    id: item.id,
    image: item.image,
    nama: item.name,
    jumlah: item.total_requests as unknown as string,
    tujuan: item.type,
  }));

  return (
    <InboxContent entries={entries} lembagaId={lembagaId} basePath={basePath} />
  );
}
