'use client';

// Library Import
import { PersonIcon } from '@radix-ui/react-icons';
import Image, { type StaticImageData } from 'next/image';
import React from 'react';
// Components Import
import { Card } from '~/components/ui/card';

interface LembagaCardProps {
  id?: string;
  nama: string;
  kategori: string;
  deskripsi: string;
  lembagaPicture: StaticImageData | string | null;
  memberCount?: number | null;
  position?: string;
  division?: string;
  variant?: 'horizontal' | 'vertical';
}

const LembagaCard = ({
  nama,
  kategori,
  deskripsi,
  lembagaPicture,
  memberCount,
  position,
  division,
  variant = 'horizontal',
}: LembagaCardProps) => {
  if (variant === 'vertical') {
    return (
      <Card className="flex h-[350px] w-full cursor-pointer flex-col overflow-hidden transition-shadow ease-out hover:shadow-md">
        <div className="relative aspect-[2.35] h-[250px] w-full overflow-hidden">
          <Image
            src={lembagaPicture || ''}
            alt={nama}
            className="object-cover object-top"
            fill
            sizes="(max-width: 768px) 100vw, 250px"
          />
        </div>
        <div className="relative flex h-full w-full flex-col gap-[0.6rem] px-6 py-5">
          <div className="flex w-fit items-center gap-2 rounded-full bg-primary-400 px-3 py-1 text-[0.7rem] text-white">
            <span className="line-clamp-1 font-semibold">{kategori}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="line-clamp-2 text-lg font-semibold leading-tight text-primary-400">
              {nama}
            </span>
            {memberCount !== undefined && (
              <div className="flex items-center gap-1 text-sm text-Regent-Gray">
                <PersonIcon />
                {memberCount && memberCount > 0 ? memberCount : '0'}
              </div>
            )}
          </div>
          <p className="line-clamp-2 text-sm leading-tight xl:line-clamp-3">
            {deskripsi || 'Tidak ada deskripsi'}
          </p>
          {position && division && (
            <p className="line-clamp-1 text-sm font-medium text-primary-400">
              <span className="font-semibold">
                {position} | {division}
              </span>
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-start gap-x-6 px-6 py-4 transition-all hover:shadow-md">
      <Image
        src={
          lembagaPicture || '/images/placeholder/profile-lembaga-kegiatan.png'
        }
        alt="Foto Lembaga"
        width={100}
        height={100}
        className="rounded-xl object-cover"
      />
      <div className="flex-1 space-y-1">
        <p className="line-clamp-1 text-xl font-medium text-Blue-Dark">
          {nama}
        </p>
        <p className="line-clamp-1 text-sm text-neutral-600">{kategori}</p>
        <p className="line-clamp-2 text-sm text-neutral-1000">{deskripsi}</p>
      </div>
    </Card>
  );
};

export default LembagaCard;
