import React from 'react';
import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';

interface Props {
  params: Promise<{
    profileKegiatanId: string;
  }>;
}

const HistoriBestStaffKegiatanMahasiswaPage = async (props: Props) => {
  const params = await props.params;
  const session = await getServerAuthSession();
  const { profileKegiatanId } = params;

  const historyData = await api.lembaga.getAllHistoryBestStaffKegiatan({
    event_id: profileKegiatanId,
  });

  const kegiatanInfo = await api.event.getByID({ id: profileKegiatanId });
  const namaKegiatan = kegiatanInfo?.name ?? 'Kegiatan';

  return (
    <div className="w-full flex h-screen flex-col items-center overflow-y-hidden">
      <div className="flex max-w-7xl w-full flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full flex-col gap-2">
          <h1 className="font-semibold text-[32px]">{namaKegiatan}</h1>
          <HistoriBreadCrumb
            items={[
              { label: 'Beranda', href: '/' },
              { label: 'Profil Kegiatan', href: `/mahasiswa/profile-kegiatan/${profileKegiatanId}` },
              {
                label: 'Histori Best Staff',
                href: `/mahasiswa/profile-kegiatan/${profileKegiatanId}/histori`,
              },
            ]}
          />
        </div>
        <HistoriBestStaffContent
          isKegiatan={true}
          kegiatanId={profileKegiatanId}
          initialData={historyData}          
          isReadOnly={true}        
          />
      </div>
    </div>
  );
};

export default HistoriBestStaffKegiatanMahasiswaPage;
