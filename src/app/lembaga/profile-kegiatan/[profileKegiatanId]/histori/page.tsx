import React from 'react';
import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import BestStaffForm from '~/app/lembaga/_components/best-staff-form';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { Button } from '~/components/ui/button';
import { Plus } from 'lucide-react';

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
    <div className="w-full flex h-screen flex-col items-center overflow-y-hidden">
      <div className="flex max-w-7xl w-full flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full justify-between items-start">
          <div className="flex flex-col gap-2">
            <h1 className="font-semibold text-[32px]">{namaKegiatan}</h1>
            <HistoriBreadCrumb
              items={[
                { label: 'Beranda', href: '/' },
                { label: 'Kegiatan', href: `/lembaga/profile-kegiatan/${kegiatanId}` },
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
                className="rounded-xl gap-2 px-4 py-3"
              >
                <Plus className="w-5 h-5" />
                <span className="font-semibold text-base">
                  Tambah Periode
                </span>
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
