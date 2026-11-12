import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { api } from '~/trpc/server';
import { requireManagedLembaga } from '../../../_lib/require-lembaga';

const ManageRaporIndividuPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; raporId: string }>;
}) => {
  const { lembagaId, raporId } = await params;
  await requireManagedLembaga(lembagaId);
  const base = `/manage/${lembagaId}/anggota`;

  const [raporData, profilData, profilKMData] = await Promise.all([
    api.rapor.getNilaiLembagaIndividu({
      lembagaId,
      mahasiswa_id: raporId,
    }),
    api.profil.getAllProfilLembaga({ lembaga_id: lembagaId }),
    api.profil.getAllProfilKM(),
  ]);

  return (
    <RaporIndividuPage
      raporData={raporData}
      profilData={profilData}
      profilKMData={profilKMData}
      isLembaga={true}
      id={lembagaId}
      breadcrumbItems={[
        { label: 'Anggota', href: base },
        { label: 'Rapor Individu', href: `${base}/${raporId}` },
      ]}
      canEdit={true}
    />
  );
};

export default ManageRaporIndividuPage;
