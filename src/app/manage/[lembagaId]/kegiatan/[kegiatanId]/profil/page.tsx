import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import ProfilTable from '~/app/_components/table/event-profil-table';
import { api } from '~/trpc/server';

import { requireManagedKegiatan } from '../../../../_lib/require-kegiatan';

const ManageProfilKegiatanPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string; kegiatanId: string }>;
}) => {
  const { lembagaId, kegiatanId } = await params;
  await requireManagedKegiatan(lembagaId, kegiatanId);
  const base = `/manage/${lembagaId}/kegiatan/${kegiatanId}`;

  const [profilKMData, profilKegiatanData] = await Promise.all([
    api.profil.getAllProfilKM(),
    api.profil.getAllProfilKegiatan({ event_id: kegiatanId }),
  ]);
  const profilKMMap = new Map(
    profilKMData.profil_km.map((km) => [km.id, km.description]),
  );
  const list =
    'profil_kegiatan' in profilKegiatanData
      ? profilKegiatanData.profil_kegiatan
      : [];

  const profilKegiatanList = list.map((item) => ({
    name: item.name,
    description: item.description,
  }));
  const mappingData = list.flatMap((item) =>
    item.profil_km_id.map((kmId) => ({
      profilKMDescription: profilKMMap.get(kmId) ?? 'Unknown',
      profilKegiatanName: item.name,
      description: item.description,
    })),
  );

  return (
    <div className="flex flex-col gap-y-6 pt-10 px-9 md:px-11">
      <div className="gap-y-2">
        <h1 className="text-neutral-1000 text-[32px] font-semibold">
          Profil Kegiatan
        </h1>
        <RaporBreadcrumb
          items={[
            { label: 'Kegiatan', href: `${base}/panitia` },
            { label: 'Rapor Komunal', href: `${base}/rapor` },
            { label: 'Profil Kegiatan', href: `${base}/profil` },
          ]}
        />
      </div>
      <div className="flex flex-col gap-y-4">
        <h2 className="text-neutral-700 text-[20px] font-normal">
          Profil Kegiatan
        </h2>
        <ProfilTable profilData={profilKegiatanList} showMapping={false} />
      </div>
      <div className="flex flex-col gap-y-4">
        <h2 className="text-neutral-700 text-[20px] font-normal">
          Detail Pemetaan Profil Kegiatan
        </h2>
        <ProfilTable profilData={mappingData} showMapping={true} />
      </div>
    </div>
  );
};

export default ManageProfilKegiatanPage;
