import { type z } from 'zod';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import ProfilTable from '~/app/_components/table/event-profil-table';
import { type GetAllProfilOutputSchema } from '~/server/api/types/profil.type';
import { type GetNilaiKegiatanIndividuOutputSchema } from '~/server/api/types/rapor.type';

import RaporIndividuHeader from './rapor-individu-header';

type NilaiOutput = z.infer<typeof GetNilaiKegiatanIndividuOutputSchema>;
type ProfilOutput = z.infer<typeof GetAllProfilOutputSchema>;

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface RaporIndividuPageProps {
  raporData: NilaiOutput;
  profilData: ProfilOutput;
  profilKMData: { profil_km: Array<{ id: string; description: string }> };
  isLembaga: boolean;
  id: string;
  /** Lembaga yang dikelola; wajib untuk rapor kegiatan. */
  lembagaId?: string;
  breadcrumbItems: BreadcrumbItem[];
  canEdit?: boolean;
}

export default function RaporIndividuPage({
  raporData,
  profilData,
  profilKMData,
  isLembaga,
  id,
  lembagaId,
  breadcrumbItems,
  canEdit = false,
}: RaporIndividuPageProps) {
  const profilKMMap = new Map(
    profilKMData.profil_km.map((km) => [km.id, km.description]),
  );

  const profilList =
    isLembaga && 'profil_lembaga' in profilData
      ? profilData.profil_lembaga.map((item) => ({
          name: item.name,
          description: item.description,
        }))
      : !isLembaga && 'profil_kegiatan' in profilData
        ? profilData.profil_kegiatan.map((item) => ({
            name: item.name,
            description: item.description,
          }))
        : [];

  const mappingData =
    isLembaga && 'profil_lembaga' in profilData
      ? profilData.profil_lembaga.flatMap((item) =>
          item.profil_km_id.map((kmId) => ({
            profilKMDescription: profilKMMap.get(kmId) ?? 'Unknown',
            profilKegiatanName: item.name,
            description: item.description,
          })),
        )
      : !isLembaga && 'profil_kegiatan' in profilData
        ? profilData.profil_kegiatan.flatMap((item) =>
            item.profil_km_id.map((kmId) => ({
              profilKMDescription: profilKMMap.get(kmId) ?? 'Unknown',
              profilKegiatanName: item.name,
              description: item.description,
            })),
          )
        : [];

  return (
    <main className="flex flex-col p-4 sm:p-6 md:p-8 min-h-screen w-full overflow-hidden">
      <div className="flex flex-col pb-4 sm:pb-6 md:pb-7 border-b border-neutral-400 mb-6 sm:mb-7 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-[32px] font-semibold mb-2 text-neutral-1000">
          Rapor Individu
        </h1>
        <RaporBreadcrumb items={breadcrumbItems} />
      </div>

      <div className="flex flex-col gap-8 sm:gap-12 md:gap-16 w-full">
        <RaporIndividuHeader
          dataNilaiProfil={raporData}
          id={id}
          lembagaId={lembagaId}
          isLembaga={isLembaga}
          canEdit={canEdit}
        />

        <div className="flex flex-col gap-y-3 sm:gap-y-4 w-full min-w-0">
          <h2 className="text-neutral-700 text-lg sm:text-xl md:text-[20px] font-normal">
            Profil {isLembaga ? 'Lembaga' : 'Kegiatan'}
          </h2>
          <ProfilTable
            profilData={profilList}
            showMapping={false}
            isLembaga={isLembaga}
          />
        </div>

        <div className="flex flex-col gap-y-3 sm:gap-y-4 w-full min-w-0">
          <h2 className="text-neutral-700 text-lg sm:text-xl md:text-[20px] font-normal">
            Detail Pemetaan Profil {isLembaga ? 'Lembaga' : 'Kegiatan'}
          </h2>
          <ProfilTable
            profilData={mappingData}
            showMapping={true}
            isLembaga={isLembaga}
          />
        </div>
      </div>
    </main>
  );
}
