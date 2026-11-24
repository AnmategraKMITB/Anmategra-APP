import { TableCell, TableRow } from '~/components/ui/table';

import { type ProfilRowProps } from '../../lembaga/kegiatan/[kegiatanId]/profil/constant';

const ProfilRow = ({ profilGroup }: ProfilRowProps) => {
  return (
    <>
      {profilGroup.eventProfil.map((eventProfil, index) => (
        <TableRow key={`${profilGroup.kmProfil}-${eventProfil.profilId}`}>
          {/* Only render KM Profil cell for the first event profil */}
          {index === 0 && (
            <TableCell
              className="pr-8 align-middle font-normal"
              rowSpan={profilGroup.eventProfil.length}
            >
              {profilGroup.kmProfil}
            </TableCell>
          )}
          <TableCell>Profil {eventProfil.profilId}</TableCell>
          <TableCell>{eventProfil.profilDescription}</TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default ProfilRow;
