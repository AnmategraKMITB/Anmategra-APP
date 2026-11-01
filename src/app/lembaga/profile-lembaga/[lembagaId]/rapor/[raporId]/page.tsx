import { Lock } from 'lucide-react';
import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiLembagaIndividuOutputSchema } from '~/server/api/types/rapor.type';
import { api } from '~/trpc/server';

export type ProfilOutput = z.infer<typeof GetAllProfilOutputSchema>;

interface RaporIndividuMahasiswaLembagaPageProps {
  params: Promise<{
    lembagaId: string;
    raporId: string;
  }>;
}

export default async function RaporIndividuMahasiswaLembagaPage(props: RaporIndividuMahasiswaLembagaPageProps) {
  const params = await props.params;
  const { lembagaId, raporId } = params;

  try {
    const [raporData, profilData, profilKMData] = await Promise.all([
      api.rapor.getNilaiLembagaIndividuPublic({
        lembaga_id: lembagaId,
        mahasiswa_id: raporId,
      }),
      api.profil.getAllProfilLembaga({
        lembaga_id: lembagaId,
      }),
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
          {
            label: 'Profile Lembaga',
            href: `/profile-lembaga/${lembagaId}`,
          },
          {
            label: 'Rapor Individu',
            href: `/profile-lembaga/${lembagaId}/rapor/${raporId}`,
          },
        ]}
        canEdit={false}
      />
    );
  } catch (error) {
    return (
      <main className="flex flex-col p-4 sm:p-6 md:p-8 min-h-screen w-full overflow-hidden">
        <div className="flex flex-col pb-4 sm:pb-6 md:pb-7 border-b border-neutral-400 mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-semibold mb-2 text-neutral-1000">
            Rapor Individu
          </h1>
          <RaporBreadcrumb
            items={[
              { label: 'Profile Lembaga', href: `/profile-lembaga/${lembagaId}` },
              { label: 'Rapor Individu', href: `/profile-lembaga/${lembagaId}/rapor/${raporId}` },
            ]}
          />
        </div>
        <div className="text-center flex flex-col items-center justify-center space-y-8 py-6 sm:py-8">
          <Lock className='size-20 text-neutral-500' />
          <p className="text-sm sm:text-base text-neutral-500">
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
