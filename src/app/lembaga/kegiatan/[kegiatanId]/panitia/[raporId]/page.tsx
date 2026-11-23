import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiKegiatanIndividuOutputSchema } from '~/server/api/types/rapor.type';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

type NilaiKegiatanOutput = z.infer<typeof GetNilaiKegiatanIndividuOutputSchema>;
export type ProfilOutput = z.infer<typeof GetAllProfilOutputSchema>;

interface RaporIndividuPanitiaPageProps {
  params: Promise<{
    kegiatanId: string;
    raporId: string;
  }>;
}

export default async function RaporIndividuPanitiaPage(
  props: RaporIndividuPanitiaPageProps,
) {
  const params = await props.params;
  const { kegiatanId, raporId } = params;
  const session = await getServerAuthSession();
  const lembagaId = session?.user.lembagaId ?? '';

  try {
    const [raporData, profilData, profilKMData] = await Promise.all([
      api.rapor.getNilaiKegiatanIndividu({
        lembagaId,
        event_id: kegiatanId,
        mahasiswa_id: raporId,
      }),
      api.profil.getAllProfilKegiatan({
        event_id: kegiatanId,
      }),
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
          {
            label: 'Kegiatan',
            href: `/lembaga/kegiatan/${kegiatanId}/panitia`,
          },
          { label: 'Rapor', href: `/lembaga/kegiatan/${kegiatanId}/rapor` },
          {
            label: 'Rapor Individu',
            href: `/lembaga/kegiatan/${kegiatanId}/panitia/${raporId}`,
          },
        ]}
        canEdit={true}
      />
    );
  } catch {
    return (
      <main className="flex min-h-screen w-full flex-col overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="mb-6 flex flex-col border-b border-neutral-400 pb-4 sm:mb-7 sm:pb-6 md:mb-8 md:pb-7">
          <h1 className="mb-2 text-2xl font-semibold text-neutral-1000 sm:text-3xl md:text-[32px]">
            Rapor Individu
          </h1>
          <RaporBreadcrumb
            items={[
              { label: 'Kegiatan', href: '/lembaga/kegiatan' },
              { label: 'Panitia', href: '/lembaga/kegiatan' },
              { label: 'Rapor Individu', href: '/lembaga/kegiatan' },
            ]}
          />
        </div>
        <div className="py-6 text-center sm:py-8">
          <p className="text-sm text-neutral-500 sm:text-base">
            Gagal memuat data rapor individu
          </p>
        </div>
      </main>
    );
  }
}
