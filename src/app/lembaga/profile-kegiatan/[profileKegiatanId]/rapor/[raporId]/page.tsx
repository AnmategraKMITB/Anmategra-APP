import { Lock } from 'lucide-react';
import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiKegiatanIndividuOutputSchema } from '~/server/api/types/rapor.type';
import { api } from '~/trpc/server';

type NilaiKegiatanOutput = z.infer<typeof GetNilaiKegiatanIndividuOutputSchema>;
export type ProfilOutput = z.infer<typeof GetAllProfilOutputSchema>;

interface RaporIndividuMahasiswaKegiatanPageProps {
  params: Promise<{
    profileKegiatanId: string;
    raporId: string;
  }>;
}

export default async function RaporIndividuMahasiswaKegiatanPage(
  props: RaporIndividuMahasiswaKegiatanPageProps,
) {
  const params = await props.params;
  const { profileKegiatanId, raporId } = params;

  try {
    const [raporData, profilData, profilKMData] = await Promise.all([
      api.rapor.getNilaiKegiatanIndividuPublic({
        event_id: profileKegiatanId,
        mahasiswa_id: raporId,
      }),
      api.profil.getAllProfilKegiatan({
        event_id: profileKegiatanId,
      }),
      api.profil.getAllProfilKM(),
    ]);

    return (
      <RaporIndividuPage
        raporData={raporData}
        profilData={profilData}
        profilKMData={profilKMData}
        isLembaga={false}
        id={profileKegiatanId}
        breadcrumbItems={[
          {
            label: 'Profile Kegiatan',
            href: `/profile-kegiatan/${profileKegiatanId}`,
          },
          {
            label: 'Rapor Individu',
            href: `/profile-kegiatan/${profileKegiatanId}/rapor/${raporId}`,
          },
        ]}
        canEdit={false}
      />
    );
  } catch (error) {
    return (
      <main className="flex min-h-screen w-full flex-col overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="mb-6 flex flex-col border-b border-neutral-400 pb-4 sm:mb-7 sm:pb-6 md:mb-8 md:pb-7">
          <h1 className="mb-2 text-2xl font-semibold text-neutral-1000 sm:text-3xl md:text-[32px]">
            Rapor Individu
          </h1>
          <RaporBreadcrumb
            items={[
              {
                label: 'Profile Kegiatan',
                href: `/profile-kegiatan/${profileKegiatanId}`,
              },
              {
                label: 'Rapor Individu',
                href: `/profile-kegiatan/${profileKegiatanId}/rapor/${raporId}`,
              },
            ]}
          />
        </div>
        <div className="flex flex-col items-center justify-center space-y-8 py-6 text-center sm:py-8">
          <Lock className="size-20 text-neutral-500" />
          <p className="text-sm text-neutral-500 sm:text-base">
            {error instanceof Error &&
            error.message.includes('tidak dapat diakses')
              ? 'Rapor tidak dapat diakses. Rapor mungkin tidak dipublikasikan.'
              : 'Gagal memuat data rapor individu'}
          </p>
        </div>
      </main>
    );
  }
}
