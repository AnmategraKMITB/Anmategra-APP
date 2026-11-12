import AnggotaContent from '~/app/lembaga/anggota/_components/anggota-content';
import { api } from '~/trpc/server';

import { requireManagedKegiatan } from '../../../../_lib/require-kegiatan';

const ManagePanitiaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; kegiatanId: string }>;
}) => {
  const { lembagaId, kegiatanId } = await params;
  const { session, event } = await requireManagedKegiatan(
    lembagaId,
    kegiatanId,
  );

  const [anggota, posisiBidang] = await Promise.all([
    api.event.getAllAnggota({ event_id: kegiatanId }),
    api.kegiatan.getPosisiBidangOptions({
      lembagaId,
      event_id: kegiatanId,
    }),
  ]);

  return (
    <main>
      <AnggotaContent
        session={session}
        data={anggota ?? []}
        dataPosisiBidang={posisiBidang}
        pageAnggota={false}
        title={event.name}
        lembagaId={lembagaId}
        eventId={kegiatanId}
        kegiatanBasePath={`/manage/${lembagaId}`}
        showBestStaff={false}
      />
    </main>
  );
};

export default ManagePanitiaPage;
