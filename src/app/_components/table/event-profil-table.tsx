import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

interface ProfilKegiatan {
  name: string;
  description: string;
}

interface ProfilMapping {
  profilKMDescription: string;
  profilKegiatanName: string;
  description: string;
}

interface ProfilTableProps {
  profilData: ProfilKegiatan[] | ProfilMapping[];
  showMapping: boolean;
  isLembaga?: boolean;
}

const ProfilTable = ({
  profilData,
  showMapping,
  isLembaga = false,
}: ProfilTableProps) => {
  if (profilData.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-neutral-500">
          Belum ada profil {isLembaga ? 'lembaga' : 'kegiatan'}
        </p>
      </div>
    );
  }

  if (!showMapping) {
    const profilList = profilData as ProfilKegiatan[];
    return (
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%] text-sm font-normal text-neutral-500 sm:text-base md:text-lg">
                Profil {isLembaga ? 'Lembaga' : 'Kegiatan'}
              </TableHead>
              <TableHead className="w-[70%] text-sm font-normal text-neutral-500 sm:text-base md:text-lg">
                Deskripsi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm font-normal leading-6 text-neutral-700 sm:text-base sm:leading-7 md:text-lg md:leading-8">
            {profilList.map((profil, index) => (
              <TableRow key={index}>
                <TableCell className="break-words align-top">
                  {profil.name}
                </TableCell>
                <TableCell className="break-words align-top">
                  {profil.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Mapping
  const mappingList = profilData as ProfilMapping[];

  const groupedMappings: {
    profilKM: string;
    profils: Array<{ name: string; description: string }>;
  }[] = [];
  const kmMap = new Map<string, Array<{ name: string; description: string }>>();

  mappingList.forEach((mapping) => {
    if (!kmMap.has(mapping.profilKMDescription)) {
      kmMap.set(mapping.profilKMDescription, []);
    }
    kmMap.get(mapping.profilKMDescription)!.push({
      name: mapping.profilKegiatanName,
      description: mapping.description,
    });
  });

  kmMap.forEach((profils, profilKM) => {
    groupedMappings.push({ profilKM, profils });
  });

  return (
    <div className="scrollbar-thin w-full overflow-x-scroll">
      <Table className="w-full min-w-[700px] table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%] min-w-[200px] text-sm font-normal text-neutral-500 sm:text-base md:text-lg">
              Profil KM ITB
            </TableHead>
            <TableHead className="w-[25%] min-w-[150px] text-sm font-normal text-neutral-500 sm:text-base md:text-lg">
              Profil {isLembaga ? 'Lembaga' : 'Kegiatan'}
            </TableHead>
            <TableHead className="w-[40%] min-w-[250px] text-sm font-normal text-neutral-500 sm:text-base md:text-lg">
              Deskripsi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-sm font-normal leading-6 text-neutral-700 sm:text-base sm:leading-7 md:text-lg md:leading-8">
          {groupedMappings.map((group, groupIndex) =>
            group.profils.map((profil, profilIndex) => (
              <TableRow key={`${groupIndex}-${profilIndex}`}>
                {profilIndex === 0 && (
                  <TableCell
                    className="break-words border-r pr-2 align-top sm:pr-4 md:pr-6"
                    rowSpan={group.profils.length}
                  >
                    {group.profilKM}
                  </TableCell>
                )}
                <TableCell className="break-words align-top">
                  {profil.name}
                </TableCell>
                <TableCell className="break-words align-top">
                  {profil.description}
                </TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProfilTable;
