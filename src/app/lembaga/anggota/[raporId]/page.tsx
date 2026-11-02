import React from 'react';
import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import RaporIndividuPage from '~/app/_components/rapor/individu/rapor-individu-page';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiLembagaIndividuOutputSchema } from '~/server/api/types/rapor.type';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

type NilaiLembagaOutput = z.infer<typeof GetNilaiLembagaIndividuOutputSchema>;
type ProfilLembagaOutput = z.infer<typeof GetAllProfilOutputSchema>;

interface RaporIndividuLembagaPageProps {
  params: Promise<{
    raporId: string;
  }>;
}

export default async function RaporIndividuLembagaPage(
  props: RaporIndividuLembagaPageProps,
) {
  const params = await props.params;
  const { raporId } = params;

  const session = await getServerAuthSession();

  try {
    const [raporData, profilData, profilKMData] = await Promise.all([
      api.rapor.getNilaiLembagaIndividu({
        lembaga_id: session?.user.lembagaId ?? '',
        mahasiswa_id: raporId,
      }),
      api.profil.getAllProfilLembaga({
        lembaga_id: session?.user.lembagaId ?? '',
      }),
      api.profil.getAllProfilKM(),
    ]);

    return (
      <RaporIndividuPage
        raporData={raporData}
        profilData={profilData}
        profilKMData={profilKMData}
        isLembaga={true}
        id={session?.user.lembagaId ?? ''}
        breadcrumbItems={[
          { label: 'Anggota', href: '/lembaga/anggota' },
          { label: 'Rapor Individu', href: `/lembaga/anggota/${raporId}` },
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
              { label: 'Anggota', href: '/lembaga/anggota' },
              { label: 'Rapor Individu', href: '/lembaga/anggota' },
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
