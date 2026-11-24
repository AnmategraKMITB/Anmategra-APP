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
        lembagaId: session?.user.lembagaId ?? '',
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
      <main className="flex min-h-screen w-full flex-col overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="mb-6 flex flex-col border-b border-neutral-400 pb-4 sm:mb-7 sm:pb-6 md:mb-8 md:pb-7">
          <h1 className="mb-2 text-2xl font-semibold text-neutral-1000 sm:text-3xl md:text-[32px]">
            Rapor Individu
          </h1>
          <RaporBreadcrumb
            items={[
              { label: 'Anggota', href: '/lembaga/anggota' },
              { label: 'Rapor Individu', href: '/lembaga/anggota' },
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
