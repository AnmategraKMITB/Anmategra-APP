// Library Import
// Asset Import
import Image, { type StaticImageData } from 'next/image';
import React from 'react';
// Components Import
import { Card } from '~/components/ui/card';

const MahasiswaCard = ({
  nama,
  NIM,
  jurusan,
  profilePicture,
}: {
  nama: string;
  NIM: string;
  jurusan: string;
  profilePicture: StaticImageData | string;
}) => {
  return (
    <Card className="flex h-[150px] w-full max-w-[400px] items-center gap-x-3 px-4 py-4 transition-all hover:shadow-md sm:gap-x-4 sm:px-6">
      <Image
        src={profilePicture}
        alt="Profile Picture"
        width={80}
        height={80}
        className="h-20 w-20 flex-shrink-0 rounded-full object-cover sm:h-[100px] sm:w-[100px]"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-base font-semibold text-neutral-1000 sm:text-lg">
          {nama}
        </p>
        <p className="truncate text-xs text-neutral-700 sm:text-sm">{NIM}</p>
        <p className="truncate text-xs text-neutral-700 sm:text-sm">
          {jurusan}
        </p>
      </div>
    </Card>
  );
};

export default MahasiswaCard;
