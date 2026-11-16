import HistoriView from '~/app/lembaga/anggota/histori/_components/histori-view';

import { requireManagedLembaga } from '../../../_lib/require-lembaga';

const ManageHistoriPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  await requireManagedLembaga(lembagaId);
  return (
    <HistoriView
      lembagaId={lembagaId}
      anggotaPath={`/manage/${lembagaId}/anggota`}
    />
  );
};

export default ManageHistoriPage;
