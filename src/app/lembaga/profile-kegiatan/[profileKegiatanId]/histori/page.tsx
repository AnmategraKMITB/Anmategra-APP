import { Plus } from 'lucide-react';
import React from 'react';
import BestStaffForm from '~/app/lembaga/_components/best-staff-form';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { Button } from '~/components/ui/button';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

interface Props {
  params: Promise<{
    profileKegiatanId: string;
  }>;
}

const HistoriBestStaffKegiatanPage = async (props: Props) => {
  const params = await props.params;
  const session = await getServerAuthSession();
  const { profileKegiatanId: kegiatanId } = params;

  const historyData = await api.lembaga.getAllHistoryBestStaffKegiatan({
    event_id: kegiatanId,
  });

  const kegiatanInfo = await api.event.getByID({ id: kegiatanId });
  const namaKegiatan = kegiatanInfo?.name ?? 'Kegiatan';
  const lembagaId = session?.user?.lembagaId;

  return (
    <div className="flex h-screen w-full flex-col items-center overflow-y-hidden">
      <div className="flex w-full max-w-7xl flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-semibold">{namaKegiatan}</h1>
            <HistoriBreadCrumb
              items={[
                { label: 'Beranda', href: '/' },
                {
                  label: 'Kegiatan',
                  href: `/lembaga/profile-kegiatan/${kegiatanId}`,
                },
                {
                  label: 'Histori Best Staff',
                  href: `/lembaga/profile-kegiatan/${kegiatanId}/histori`,
                },
              ]}
            />
          </div>
          <BestStaffForm
            mode="add"
            lembagaId={lembagaId}
            eventId={kegiatanId}
            trigger={
              <Button
                variant="dark_blue"
                className="gap-2 rounded-xl px-4 py-3"
              >
                <Plus className="h-5 w-5" />
                <span className="text-base font-semibold">Tambah Periode</span>
              </Button>
            }
          />
        </div>
        <HistoriBestStaffContent
          isKegiatan={true}
          lembagaId={lembagaId}
          kegiatanId={kegiatanId}
          initialData={historyData}
        />
      </div>
    </div>
  );
};

export default HistoriBestStaffKegiatanPage;
