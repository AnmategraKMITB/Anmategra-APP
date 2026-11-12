import ProfilLembagaView from '~/app/lembaga/profil/_components/profil-lembaga-view';
import { requireManagedLembaga } from '../../_lib/require-lembaga';

const ManageProfilPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  await requireManagedLembaga(lembagaId);
  const base = `/manage/${lembagaId}`;

  return (
    <ProfilLembagaView
      lembagaId={lembagaId}
      breadcrumbItems={[
        { label: 'Anggota', href: `${base}/anggota` },
        { label: 'Rapor Komunal', href: `${base}/anggota/rapor` },
        { label: 'Profil Lembaga', href: `${base}/profil` },
      ]}
    />
  );
};

export default ManageProfilPage;
