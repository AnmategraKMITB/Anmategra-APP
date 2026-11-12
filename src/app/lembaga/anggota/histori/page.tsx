import { redirect } from 'next/navigation';
import { getServerAuthSession } from '~/server/auth';

import HistoriView from './_components/histori-view';

const HistoriBestStaffAnggotaPage = async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.lembagaId) {
    redirect('/authentication');
  }
  return (
    <HistoriView lembagaId={session.user.lembagaId} anggotaPath="/anggota" />
  );
};

export default HistoriBestStaffAnggotaPage;
