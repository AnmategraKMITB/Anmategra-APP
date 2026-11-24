import React from 'react';

import NilaiProfilCard from '../../card/nilai-profil-card';
import { type Profile } from '../../form/form-nilai-profil';

type NilaiProfilCompProps = {
  nilaiProfils?: Profile[];
  isLembaga?: boolean;
};

export default function NilaiProfilComp({
  nilaiProfils,
  isLembaga,
}: NilaiProfilCompProps) {
  return (
    <div className="flex w-full flex-col gap-3 sm:gap-[15px]">
      <div className="text-lg text-neutral-700 sm:text-xl md:text-[20px]">
        {isLembaga ? 'Nilai Profil Lembaga' : 'Nilai Profil Kegiatan'}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:gap-4 md:gap-6">
        {nilaiProfils?.map((profil, index) => (
          <NilaiProfilCard
            key={index}
            name={profil.profil_name}
            nilai={profil.nilai ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
