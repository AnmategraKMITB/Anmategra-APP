import React from 'react';
import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { redirect } from 'next/navigation';

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
    <div className="w-full flex h-screen flex-col items-center overflow-y-hidden">
      <div className="flex max-w-7xl w-full flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full flex-col gap-2">
          <h1 className="font-semibold text-[32px]">{namaLembaga}</h1>
          <HistoriBreadCrumb
            items={[
              { label: 'Beranda', href: '/' },
              { label: 'Profil Lembaga', href: `/mahasiswa/profile-lembaga/${lembagaId}` },
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
