'use client';

import { Pencil, X } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

export type Profile = {
  profil_id: string;
  nilai: number | null;
  profil_name: string;
};

// Komponen FormProfil
interface FormProfilProps {
  profiles: Profile[];
  onChange: (id: string, nilai: number | null) => void;
}

const FormProfil: React.FC<FormProfilProps> = ({ profiles, onChange }) => {
  return (
    <div className="flex flex-col gap-4">
      {profiles.map((p, idx) => (
        <div key={p.profil_id} className="flex items-center justify-between">
          <label className="text-[20px] font-[400] leading-[32px] text-[#141718]">
            {p.profil_name}
          </label>
          <div className="flex h-[50px] w-[92px] items-center rounded-[12px] border border-[#C4CACE] bg-white px-4 py-1">
            <input
              type="number"
              value={p.nilai ?? ''}
              onChange={(e) => {
                // Menghilangkan leading 0
                const val = e.target.value;
                const numeric = val === '' ? null : Number(val);
                onChange(p.profil_id, numeric);
              }}
              className="w-full text-center text-[18px] font-[400] leading-[32px] text-[#636A6D] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min={0}
              max={100}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Menerima initialProfiles sebagai prop
interface FormNilaiProfilProps {
  initialProfiles?: Profile[];
  onSave?: (updatedProfiles: Profile[]) => void;
}

const FormNilaiProfil: React.FC<FormNilaiProfilProps> = ({
  initialProfiles,
  onSave,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles ?? []);

  const handleProfileChange = (id: string, value: number | null) => {
    const sanitized = value === null ? null : Math.min(Math.max(value, 0), 100);
    setProfiles(
      profiles.map((p) =>
        p.profil_id === id ? { ...p, value: sanitized } : p,
      ),
    );
  };

  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSaveProfile = () => {
    // Validasi input
    for (const p of profiles) {
      if (p.nilai === null || isNaN(p.nilai) || p.nilai < 0 || p.nilai > 100) {
        setErrorMessage(
          'Pastikan semua profil terisi dan memiliki nilai antara 0-100',
        );
        return; // tetap buka dialog
      }
    }
    if (onSave) {
      onSave(profiles);
    }

    // Jika valid, simpan data & tutup dialog
    setErrorMessage('');
    setOpen(false);
  };

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w[133px] flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00B7B7] px-4 hover:bg-[#51c8c4] sm:h-12 sm:rounded-[16px] sm:px-6 md:h-[50px]">
          <Pencil size={40} className="!h-4 !w-4 sm:!h-5 sm:!w-5" />
          <div className="text-sm font-semibold leading-tight text-white sm:text-base sm:leading-[26px] md:text-[18px]">
            Edit Nilai
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex items-center justify-center border-0 bg-transparent p-0 shadow-none [&>button]:hidden"
        aria-describedby={undefined}
      >
        <Card className="relative flex max-h-[90vh] w-[309px] flex-col gap-[10px] overflow-y-auto rounded-[26.1px] border border-[#C4CACE] bg-white pb-[27px] pl-[37px] pr-[37px] pt-[35px]">
          <DialogHeader>
            <DialogTitle className="text-center text-[24px] font-semibold leading-[40px] text-[#141718]">
              Edit Nilai Profil
            </DialogTitle>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center p-0 hover:bg-transparent"
              >
                <X strokeWidth={1.7} className="!h-6 !w-6" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <FormProfil profiles={profiles} onChange={handleProfileChange} />

          {errorMessage && (
            <div className="mt-2 text-center text-[14px] text-red-600">
              {errorMessage}
            </div>
          )}

          <Button
            onClick={handleSaveProfile}
            className="mx-auto mt-3 flex h-[40px] w-[196px] items-center justify-center rounded-[12px] border-[2px] border-[#2B6282] bg-[#2B6282] text-[14px] font-[700] leading-[16px] text-white hover:bg-[#1c4f6c]"
          >
            SIMPAN PERUBAHAN
          </Button>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default FormNilaiProfil;
