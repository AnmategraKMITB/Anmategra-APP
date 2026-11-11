import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiKegiatanIndividuOutputSchema } from '~/server/api/types/rapor.type';
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

  try {
    const [raporData, profilData, profilKMData] = await Promise.all([
      api.rapor.getNilaiKegiatanIndividu({
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
      <main className="flex flex-col p-4 sm:p-6 md:p-8 min-h-screen w-full overflow-hidden">
        <div className="flex flex-col pb-4 sm:pb-6 md:pb-7 border-b border-neutral-400 mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-semibold mb-2 text-neutral-1000">
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
        <div className="text-center py-6 sm:py-8">
          <p className="text-sm sm:text-base text-neutral-500">
            Gagal memuat data rapor individu
          </p>
        </div>
      </main>
    );
  }
}
