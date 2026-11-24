import { MoreVertical, Pencil, Trash } from 'lucide-react';
import { Button } from '~/components/ui/button';

export default function ProfilMenu({
  colIdx,
  menu,
  setMenu,
  handleEditProfil,
  handleDeleteProfil,
}: {
  colIdx: number;
  menu: { row: number; col: number } | null;
  setMenu: (val: { row: number; col: number } | null) => void;
  handleEditProfil: (colIdx: number) => void;
  handleDeleteProfil: (colIdx: number) => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMenu({ row: -1, col: colIdx })}
      >
        <MoreVertical size={16} />
      </Button>
      {menu && menu.row === -1 && menu.col === colIdx && (
        <div className="absolute left-0 top-full z-10 rounded-2xl border bg-white shadow">
          <Button
            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
            variant="ghost"
            onClick={() => handleEditProfil(colIdx)}
          >
            <Pencil size={16} className="mr-2 inline text-[#00B7B7]" />
            Edit Profil
          </Button>
          <hr className="border-t border-gray-200" />
          <Button
            className="block w-full px-4 py-2 text-left hover:bg-gray-100"
            variant="ghost"
            onClick={() => handleDeleteProfil(colIdx)}
          >
            <Trash size={16} className="mr-2 inline text-[#F16350]" />
            Delete Profil
          </Button>
        </div>
      )}
    </>
  );
}
