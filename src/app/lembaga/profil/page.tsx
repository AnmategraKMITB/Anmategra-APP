import { getServerAuthSession } from '~/server/auth';
import ProfilLembagaView from './_components/profil-lembaga-view';

const ProfilLembaga = async () => {
  const session = await getServerAuthSession();
  return (
    <ProfilLembagaView
      lembagaId={session?.user?.lembagaId ?? ''}
      breadcrumbItems={[
        { label: 'Anggota', href: '/lembaga/anggota' },
        { label: 'Rapor Komunal', href: '/lembaga/anggota/rapor' },
        { label: 'Profil Lembaga', href: '/lembaga/profil' },
      ]}
    />
  );
};

export default ProfilLembaga;
