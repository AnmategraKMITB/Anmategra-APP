// Server Auth
// Components Import
import AnggotaContent from '~/app/lembaga/anggota/_components/anggota-content';
import { getServerAuthSession } from '~/server/auth';
// Api Import
import { api } from '~/trpc/server';

export default async function Home() {
  const session = await getServerAuthSession();
  const anggota = await api.lembaga.getAllAnggota({
    lembagaId: session?.user.lembagaId ?? '',
  });

  const getPosisiBidang = await api.lembaga.getPosisiBidangOptions({
    lembagaId: session?.user.lembagaId ?? '',
  });

  const lembaga = await api.lembaga.getInfo({
    lembagaId: session?.user.lembagaId ?? '',
  });

  return (
    <main>
      {/* <AnggotaContent
        session={mockSession}
        data={mockAnggotaData}
        dataAddAnggota={mockAddAnggotaProps}
      /> */}
      <AnggotaContent
        session={session}
        data={anggota}
        dataPosisiBidang={getPosisiBidang}
        pageAnggota={true}
        title={lembaga?.nama ?? ''}
      />
    </main>
  );
}
