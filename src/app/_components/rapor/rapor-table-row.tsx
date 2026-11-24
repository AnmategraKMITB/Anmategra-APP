import { TableCell, TableRow } from '~/components/ui/table';

type Anggota = { nama: string; nim: string; profil: string[] };

export default function RaporTableRow({
  row,
  editNilaiMode,
  editedData,
  setEditedData,
  absoluteRowIdx,
}: {
  row: Anggota;
  editNilaiMode: boolean;
  editedData: Anggota[] | null;
  setEditedData: (fn: (prev: Anggota[] | null) => any[] | null) => void;
  absoluteRowIdx: number;
}) {
  const handleInputChange = (colIdx: number, newValue: string) => {
    setEditedData((prev) => {
      if (!prev) return prev;

      const updated = [...prev];
      if (updated[absoluteRowIdx]) {
        updated[absoluteRowIdx] = {
          ...updated[absoluteRowIdx],
          profil: [...updated[absoluteRowIdx].profil],
        };
        updated[absoluteRowIdx].profil[colIdx] = newValue;
      }

      return updated;
    });
  };

  return (
    <TableRow className="text-neutral-700">
      <TableCell className="sticky left-0 z-10 border-b border-[#E0E5E8] bg-neutral-100">
        {row.nama}
      </TableCell>
      <TableCell className="sticky left-[283px] z-10 border-b border-[#E0E5E8] bg-neutral-100">
        {row.nim}
      </TableCell>
      {row.profil.map((val: string, colIdx: number) => {
        const editedValue =
          editedData?.[absoluteRowIdx]?.profil?.[colIdx] ?? val;

        return (
          <TableCell key={colIdx} className="border-b border-[#E0E5E8] py-0">
            {editNilaiMode ? (
              <input
                type="number"
                min={0}
                max={100}
                className="w-16 rounded border px-2 py-1"
                value={editedValue}
                onChange={(e) => handleInputChange(colIdx, e.target.value)}
              />
            ) : (
              val
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
