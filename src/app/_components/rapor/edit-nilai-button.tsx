'use client';

import { Pencil } from 'lucide-react';
import { Button } from '~/components/ui/button';

type Anggota = { nama: string; nim: string; profil: string[] };

interface EditNilaiButtonProps {
  editNilaiMode: boolean;
  setEditNilaiMode: (mode: boolean) => void;
  editedData: Anggota[] | null;
  setData: React.Dispatch<React.SetStateAction<Anggota[]>>;
  setEditedData: React.Dispatch<React.SetStateAction<Anggota[] | null>>;
  data: Anggota[];
  onSave?: () => void;
  isSaving?: boolean;
  children?: React.ReactNode;
}

export default function EditNilaiButton({
  editNilaiMode,
  setEditNilaiMode,
  editedData,
  setData,
  setEditedData,
  data,
  onSave,
  isSaving = false,
  children,
}: EditNilaiButtonProps) {
  const handleClick = () => {
    if (editNilaiMode) {
      if (onSave) {
        onSave();
      } else {
        if (editedData) {
          setData(editedData);
          setEditedData(null);
        }
        setEditNilaiMode(false);
      }
    } else {
      setEditedData(JSON.parse(JSON.stringify(data)) as Anggota[]);
      setEditNilaiMode(true);
    }
  };

  return (
    <Button
      className="mb-4 w-full rounded-2xl bg-[#2B6282] text-white hover:bg-[#2B6282] hover:text-white sm:w-auto"
      variant="ghost"
      onClick={handleClick}
      disabled={isSaving}
    >
      {children ??
        (editNilaiMode ? (
          isSaving ? (
            'Menyimpan...'
          ) : (
            'Simpan Nilai'
          )
        ) : (
          <>
            <Pencil size={16} />
            Edit Nilai
          </>
        ))}
    </Button>
  );
}
