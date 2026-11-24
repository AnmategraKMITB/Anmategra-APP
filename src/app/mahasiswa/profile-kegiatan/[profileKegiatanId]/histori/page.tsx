import React from 'react';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

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
    <div className="flex h-screen w-full flex-col items-center overflow-y-hidden">
      <div className="flex w-full max-w-7xl flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full flex-col gap-2">
          <h1 className="text-[32px] font-semibold">{namaKegiatan}</h1>
          <HistoriBreadCrumb
            items={[
              { label: 'Beranda', href: '/' },
              {
                label: 'Profil Kegiatan',
                href: `/mahasiswa/profile-kegiatan/${profileKegiatanId}`,
              },
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
