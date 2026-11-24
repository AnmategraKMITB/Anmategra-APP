import { redirect } from 'next/navigation';
import React from 'react';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

interface Props {
  params: Promise<{
    lembagaId: string;
  }>;
}

const HistoriBestStaffLembagaMahasiswaPage = async (props: Props) => {
  const params = await props.params;
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect('/authentication');
  }

  const { lembagaId } = params;

  const historyData = await api.lembaga.getAllHistoryBestStaffLembaga({
    lembaga_id: lembagaId,
  });

  const lembagaInfo = await api.profile.getLembaga({ lembagaId });
  const namaLembaga = lembagaInfo?.lembagaData?.name ?? 'Lembaga';

  return (
    <div className="flex h-screen w-full flex-col items-center overflow-y-hidden">
      <div className="flex w-full max-w-7xl flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full flex-col gap-2">
          <h1 className="text-[32px] font-semibold">{namaLembaga}</h1>
          <HistoriBreadCrumb
            items={[
              { label: 'Beranda', href: '/' },
              {
                label: 'Profil Lembaga',
                href: `/mahasiswa/profile-lembaga/${lembagaId}`,
              },
              {
                label: 'Histori Best Staff',
                href: `/mahasiswa/profile-lembaga/${lembagaId}/histori`,
              },
            ]}
          />
        </div>
        <HistoriBestStaffContent
          isKegiatan={false}
          lembagaId={lembagaId}
          initialData={historyData}
          isReadOnly={true}
        />
      </div>
    </div>
  );
};

export default HistoriBestStaffLembagaMahasiswaPage;
