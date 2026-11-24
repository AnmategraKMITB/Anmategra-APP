import { Plus } from 'lucide-react';
import React from 'react';
import BestStaffForm from '~/app/lembaga/_components/best-staff-form';
import HistoriBestStaffContent from '~/app/lembaga/_components/histori-best-staff-content';
import { HistoriBreadCrumb } from '~/app/lembaga/profile-lembaga/[lembagaId]/histori/_components/histori-breadcrumb';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/server';

/** Histori Best Staff lembaga; dipakai halaman Owner dan /manage. */
export default async function HistoriView({
  lembagaId,
  anggotaPath,
}: {
  lembagaId: string;
  /** Rute anggota tempat halaman dipasang, mis. `/anggota`. */
  anggotaPath: string;
}) {
  const historyData = await api.lembaga.getAllHistoryBestStaffLembaga({
    lembaga_id: lembagaId,
  });
  const lembagaInfo = await api.profile.getLembaga({ lembagaId });
  const namaLembaga = lembagaInfo?.lembagaData?.name ?? 'Lembaga';

  return (
    <div className="flex h-screen w-full flex-col items-center overflow-y-hidden">
      <div className="flex w-full max-w-7xl flex-col gap-6 px-9 py-[68px]">
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-semibold">{namaLembaga}</h1>
            <HistoriBreadCrumb
              items={[
                { label: 'Beranda', href: '/' },
                { label: 'Anggota', href: anggotaPath },
                {
                  label: 'Histori Best Staff',
                  href: `${anggotaPath}/histori`,
                },
              ]}
            />
          </div>
          <BestStaffForm
            mode="add"
            lembagaId={lembagaId}
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
          isKegiatan={false}
          lembagaId={lembagaId}
          initialData={historyData}
        />
      </div>
    </div>
  );
}
