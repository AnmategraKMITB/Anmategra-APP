import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { api } from '~/trpc/server';

import ProfilTable from '../../../../_components/table/event-profil-table';

interface ProfilEventProps {
  params: Promise<{
    kegiatanId: string;
  }>;
}

const ProfilEvent = async (props: ProfilEventProps) => {
  const params = await props.params;
  try {
    const [profilKMData, profilKegiatanData] = await Promise.all([
      api.profil.getAllProfilKM(),
      api.profil.getAllProfilKegiatan({ event_id: params.kegiatanId }),
    ]);

    const profilKMMap = new Map(
      profilKMData.profil_km.map((km) => [km.id, km.description]),
    );

    const profilKegiatanList =
      'profil_kegiatan' in profilKegiatanData
        ? profilKegiatanData.profil_kegiatan.map((kegiatan) => ({
            name: kegiatan.name,
            description: kegiatan.description,
          }))
        : [];

    const mappingData =
      'profil_kegiatan' in profilKegiatanData
        ? profilKegiatanData.profil_kegiatan.flatMap((kegiatan) =>
            kegiatan.profil_km_id.map((kmId) => ({
              profilKMDescription: profilKMMap.get(kmId) ?? 'Unknown',
              profilKegiatanName: kegiatan.name,
              description: kegiatan.description,
            })),
          )
        : [];

    return (
      <div className="flex flex-col gap-y-6 px-9 pt-10 md:px-11">
        <div className="gap-y-2">
          <h1 className="text-[32px] font-semibold text-neutral-1000">
            Profil Kegiatan
          </h1>
          <RaporBreadcrumb
            items={[
              {
                label: 'Kegiatan',
                href: `/lembaga/kegiatan/${params.kegiatanId}/panitia`,
              },
              {
                label: 'Rapor Komunal',
                href: `/lembaga/kegiatan/${params.kegiatanId}/rapor`,
              },
              {
                label: 'Profil Kegiatan',
                href: `/lembaga/kegiatan/${params.kegiatanId}/profil`,
              },
            ]}
          />
        </div>

        <div className="flex flex-col gap-y-4">
          <h2 className="text-[20px] font-normal text-neutral-700">
            Profil Kegiatan
          </h2>
          <ProfilTable profilData={profilKegiatanList} showMapping={false} />
        </div>

        <div className="flex flex-col gap-y-4">
          <h2 className="text-[20px] font-normal text-neutral-700">
            Detail Pemetaan Profil Kegiatan
          </h2>
          <ProfilTable profilData={mappingData} showMapping={true} />
        </div>
      </div>
    );
  } catch {
    return (
      <div className="flex flex-col gap-y-6 px-9 pt-10 md:px-11">
        <div className="gap-y-2">
          <h1 className="text-[32px] font-semibold text-neutral-1000">
            Profil Kegiatan
          </h1>
          <RaporBreadcrumb
            items={[
              { label: 'Kegiatan', href: '/lembaga/kegiatan' },
              {
                label: 'Rapor Komunal',
                href: `/lembaga/kegiatan/${params.kegiatanId}/rapor`,
              },
              {
                label: 'Profil Kegiatan',
                href: `/lembaga/kegiatan/${params.kegiatanId}/profil`,
              },
            ]}
          />
        </div>
        <div className="py-8 text-center">
          <p className="text-neutral-500">Gagal memuat data profil kegiatan</p>
        </div>
      </div>
    );
  }
};

export default ProfilEvent;
