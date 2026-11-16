import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { api } from '~/trpc/server';

import { requireManagedKegiatan } from '../../../../../_lib/require-kegiatan';

const ManageRaporIndividuPanitiaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; kegiatanId: string; raporId: string }>;
}) => {
  const { lembagaId, kegiatanId, raporId } = await params;
  await requireManagedKegiatan(lembagaId, kegiatanId);
  const base = `/manage/${lembagaId}/kegiatan/${kegiatanId}`;

  const [raporData, profilData, profilKMData] = await Promise.all([
    api.rapor.getNilaiKegiatanIndividu({
      lembagaId,
      event_id: kegiatanId,
      mahasiswa_id: raporId,
    }),
    api.profil.getAllProfilKegiatan({ event_id: kegiatanId }),
    api.profil.getAllProfilKM(),
  ]);

  return (
    <RaporIndividuPage
      raporData={raporData}
      profilData={profilData}
      profilKMData={profilKMData}
      isLembaga={false}
      id={kegiatanId}
      lembagaId={lembagaId}
      breadcrumbItems={[
        { label: 'Kegiatan', href: `${base}/panitia` },
        { label: 'Rapor', href: `${base}/rapor` },
        { label: 'Rapor Individu', href: `${base}/panitia/${raporId}` },
      ]}
      canEdit={true}
    />
  );
};

export default ManageRaporIndividuPanitiaPage;
