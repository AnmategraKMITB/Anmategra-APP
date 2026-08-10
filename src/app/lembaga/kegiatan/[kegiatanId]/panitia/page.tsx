// Library Import
import React from 'react';
// Components Import
import AnggotaContent from '~/app/lembaga/anggota/_components/anggota-content';
// Server Auth
import { getServerAuthSession } from '~/server/auth';
// Api Import
import { api } from '~/trpc/server';

const DaftarPanitiaKegiatanPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const session = await getServerAuthSession();
  const query = (await params).kegiatanId;
  const formatted_anggota = await api.event.getAllAnggota({ event_id: query });
  const getPosisiBidang = await api.kegiatan.getPosisiBidangOptions({
    event_id: query,
  });
  const event = await api.event.getByID({ id: query });
  const eventLembaga = event?.lembaga as { id: string } | undefined;

  if (event && session && eventLembaga?.id !== session?.user.lembagaId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Unauthorized Access</div>
      </div>
    )
  }
  
  return (
    <main>
      <AnggotaContent
        session={session}
        data={formatted_anggota ?? []}
        dataPosisiBidang={getPosisiBidang}
        pageAnggota={false}
        title={event?.name ?? ''}
      />
    </main>
  );
};

export default DaftarPanitiaKegiatanPage;
