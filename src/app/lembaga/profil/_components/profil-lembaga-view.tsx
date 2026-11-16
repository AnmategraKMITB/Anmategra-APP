import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import ProfilTable from '~/app/_components/table/event-profil-table';
import { api } from '~/trpc/server';

export type ProfilLembagaViewProps = {
  lembagaId: string;
  breadcrumbItems: { label: string; href: string }[];
};

async function loadProfil(lembagaId: string) {
  if (!lembagaId) return null;
  try {
    const [profilKMData, profilLembagaData] = await Promise.all([
      api.profil.getAllProfilKM(),
      api.profil.getAllProfilLembaga({ lembaga_id: lembagaId }),
    ]);
    return { profilKMData, profilLembagaData };
  } catch {
    return null;
  }
}

/** Tampilan profil lembaga; dipakai halaman Owner dan halaman /manage. */
const ProfilLembagaView = async ({
  lembagaId,
  breadcrumbItems,
}: ProfilLembagaViewProps) => {
  const data = await loadProfil(lembagaId);

  const header = (
    <div className="gap-y-2">
      <h1 className="text-neutral-1000 text-[32px] font-semibold">
        Profil Lembaga
      </h1>
      <RaporBreadcrumb items={breadcrumbItems} />
    </div>
  );

  if (!data) {
    return (
      <div className="flex flex-col gap-y-6 pt-16 px-9 md:px-11">
        {header}
        <div className="text-center py-8">
          <p className="text-neutral-500">
            {lembagaId
              ? 'Gagal memuat data profil lembaga'
              : 'Session tidak ditemukan'}
          </p>
        </div>
      </div>
    );
  }

  const { profilKMData, profilLembagaData } = data;
  const profilKMMap = new Map(
    profilKMData.profil_km.map((km) => [km.id, km.description]),
  );
  const list =
    'profil_lembaga' in profilLembagaData
      ? profilLembagaData.profil_lembaga
      : [];

  const profilLembagaList = list.map((item) => ({
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
    <div className="flex flex-col gap-y-6 pt-16 px-9 md:px-11">
      {header}
      <div className="flex flex-col gap-y-4">
        <h2 className="text-neutral-700 text-[20px] font-normal">
          Profil Lembaga
        </h2>
        <ProfilTable
          profilData={profilLembagaList}
          showMapping={false}
          isLembaga={true}
        />
      </div>
      <div className="flex flex-col gap-y-4">
        <h2 className="text-neutral-700 text-[20px] font-normal">
          Detail Pemetaan Profil Lembaga
        </h2>
        <ProfilTable
          profilData={mappingData}
          showMapping={true}
          isLembaga={true}
        />
      </div>
    </div>
  );
};

export default ProfilLembagaView;
