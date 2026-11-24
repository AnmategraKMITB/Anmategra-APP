'use client';

import Image from 'next/image';
import LineIcon from 'public/icons/line-icon-2.png';
import WAIcon from 'public/icons/wa-icon.png';
import dummyProfile from 'public/images/placeholder/profile-pic.png';
import React, { useState } from 'react';
import { type z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  type UpsertNilaiMahasiswaKegiatanInputSchema,
  type UpsertNilaiMahasiswaLembagaInputSchema,
} from '~/server/api/types/rapor.type';
import { type GetNilaiKegiatanIndividuOutputSchema } from '~/server/api/types/rapor.type';
import { api } from '~/trpc/react';

import FormNilaiProfil, { type Profile } from '../../form/form-nilai-profil';
import NilaiProfilComp from './nilai-profil-comp';

type NilaiKegiatanOutput = z.infer<typeof GetNilaiKegiatanIndividuOutputSchema>;

export type HeaderDataProps = {
  dataNilaiProfil: NilaiKegiatanOutput | null;
  id: string;
  isLembaga?: boolean;
  /** Lembaga yang dikelola; wajib untuk rapor kegiatan. */
  lembagaId?: string;
  canEdit?: boolean;
};

export default function RaporIndividuHeader({
  dataNilaiProfil,
  id,
  isLembaga,
  lembagaId,
  canEdit = true,
}: HeaderDataProps) {
  const [nilaiProfilData, setNilaiProfilData] = useState<Profile[]>(
    dataNilaiProfil?.nilai ? dataNilaiProfil.nilai : [],
  );

  const upsertMutationLembaga =
    api.rapor.upsertNilaiMahasiswaLembaga.useMutation();

  const upsertMutationKegiatan =
    api.rapor.upsertNilaiMahasiswaKegiatan.useMutation();

  const handleUpdateNilaiProfilChange = (updatedProfiles: Profile[]) => {
    setNilaiProfilData(updatedProfiles);
    if (isLembaga) {
      const upsertData = {
        lembagaId: id ?? '',
        mahasiswa: [
          {
            user_id: dataNilaiProfil?.user_id ?? '',
            nilai: updatedProfiles.map((p) => ({
              profil_id: p.profil_id,
              nilai: p.nilai ?? 0,
            })),
          },
        ],
      } satisfies z.infer<typeof UpsertNilaiMahasiswaLembagaInputSchema>;
      upsertMutationLembaga.mutate(upsertData);
    } else {
      const upsertData = {
        lembagaId: lembagaId ?? '',
        event_id: id ?? '',
        mahasiswa: [
          {
            user_id: dataNilaiProfil?.user_id ?? '',
            nilai: updatedProfiles.map((p) => ({
              profil_id: p.profil_id,
              nilai: p.nilai ?? 0,
            })),
          },
        ],
      } satisfies z.infer<typeof UpsertNilaiMahasiswaKegiatanInputSchema> & {
        lembagaId: string;
      };
      upsertMutationKegiatan.mutate(upsertData);
    }
  };

  const mahasiswaOutput = api.users.getMahasiswaByNim.useQuery({
    nim: dataNilaiProfil?.nim ?? '',
  });

  let lembagaImage = '';
  let lembagaName = '';
  let kegiatanName = '';
  if (isLembaga) {
    const lembagaOutput = api.profile.getLembaga.useQuery({
      lembagaId: id ?? '',
    });
    lembagaImage = lembagaOutput.data?.lembagaData.users.image ?? '';
    lembagaName = lembagaOutput.data?.lembagaData.name ?? '';
  } else {
    const kegiatanOutput = api.profile.getKegiatan.useQuery({
      kegiatanId: id ?? '',
    });
    lembagaImage = kegiatanOutput.data?.lembaga.image ?? '';
    lembagaName = kegiatanOutput.data?.lembaga.name ?? '';
    kegiatanName = kegiatanOutput.data?.kegiatan.name ?? '';
  }

  return (
    <div className="flex w-full flex-col items-start justify-center">
      <div className="mb-4 mt-1 flex w-full flex-col items-start justify-start gap-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-4 md:mb-8">
        <div className="flex w-fit items-center justify-center gap-2 rounded-full bg-primary-400 px-3 py-1 text-[0.7rem] text-white">
          <Avatar className="size-4 bg-white">
            <AvatarImage
              className="object-contain"
              src={
                lembagaImage ??
                '/images/placeholder/profile-lembaga-kegiatan.png'
              }
            />
            <AvatarFallback>{lembagaName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="line-clamp-1 font-semibold">{lembagaName}</span>
        </div>

        {!isLembaga && (
          <div className="items-center justify-center text-lg font-bold text-[#2B6282] sm:text-xl md:text-2xl">
            {kegiatanName ?? ''}
          </div>
        )}
      </div>

      <div className="mb-8 flex w-full flex-col items-start justify-between gap-6 sm:mb-12 md:mb-16 lg:flex-row">
        <div className="flex w-full flex-col items-start justify-start gap-4 sm:flex-row sm:items-center sm:gap-6 md:gap-10 lg:flex-1">
          <div className="relative flex max-h-24 min-h-24 min-w-24 max-w-24 flex-shrink-0 flex-col overflow-hidden rounded-full sm:max-h-32 sm:min-h-32 sm:min-w-32 sm:max-w-32 md:max-h-40 md:min-h-40 md:min-w-40 md:max-w-40">
            <Image
              src={
                mahasiswaOutput.data?.mahasiswaData.user.image ?? dummyProfile
              }
              alt="Profile Picture"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex w-full min-w-0 flex-col items-start justify-start">
            <div className="my-1 flex items-center justify-start sm:my-2">
              <div className="text-wrap text-lg font-semibold text-[#181818] sm:text-xl md:text-2xl">
                {dataNilaiProfil?.name}
              </div>
            </div>

            <div className="mb-3 grid w-full grid-cols-1 items-start justify-start gap-x-4 gap-y-3 sm:mb-[18px] sm:grid-cols-4 sm:gap-x-8 sm:gap-y-4 md:gap-x-[50px]">
              <div className="flex min-w-0 flex-col items-start justify-start">
                <div className="text-sm text-neutral-500 sm:text-base md:text-[18px]">
                  NIM
                </div>
                <div className="w-full text-wrap text-sm text-neutral-800 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.nim}
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-start justify-start">
                <div className="text-sm text-neutral-500 sm:text-base md:text-[18px]">
                  Jurusan
                </div>
                <div className="w-full text-wrap text-sm text-neutral-800 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.jurusan}
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-start justify-start">
                <div className="text-sm text-neutral-500 sm:text-base md:text-[18px]">
                  Divisi
                </div>
                <div className="w-full text-wrap text-sm text-neutral-800 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.division}
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-start justify-start">
                <div className="text-sm text-neutral-500 sm:text-base md:text-[18px]">
                  Posisi
                </div>
                <div className="w-full text-wrap text-sm text-neutral-800 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.position}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-start justify-start gap-3 sm:flex-row sm:gap-8 md:gap-20">
              <div className="flex min-w-0 flex-row items-center justify-start gap-[5px]">
                <div className="relative h-4 w-4 flex-shrink-0 sm:h-[18px] sm:w-[18px]">
                  <Image
                    src={LineIcon}
                    alt="Line Icon"
                    width={18}
                    height={18}
                    className="h-full w-full opacity-60 invert"
                    style={{ filter: 'brightness(0.5)' }}
                  />
                </div>
                <div className="text-wrap text-sm text-neutral-600 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.lineId ?? '-'}
                </div>
              </div>
              <div className="flex min-w-0 flex-row items-center justify-start gap-[5px]">
                <div className="relative h-4 w-4 flex-shrink-0 sm:h-[18px] sm:w-[18px]">
                  <Image
                    src={WAIcon}
                    alt="WA Icon"
                    width={18}
                    height={18}
                    className="h-full w-full opacity-60 invert"
                    style={{ filter: 'brightness(0.5)' }}
                  />
                </div>
                <div className="text-wrap text-sm text-neutral-600 sm:text-base md:text-[18px]">
                  {dataNilaiProfil?.whatsapp ?? '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="w-full flex-shrink-0 lg:w-auto">
            <FormNilaiProfil
              initialProfiles={dataNilaiProfil?.nilai.map((profil) => ({
                profil_id: profil.profil_id,
                nilai: profil.nilai ?? 0,
                profil_name: profil.profil_name,
              }))}
              onSave={(updatedProfiles) => {
                const updatedNilaiProfils = updatedProfiles.map((p) => ({
                  profil_id: p.profil_id,
                  nilai: p.nilai ?? 0,
                  profil_name: p.profil_name,
                }));
                handleUpdateNilaiProfilChange(updatedNilaiProfils);
              }}
            />
          </div>
        )}
      </div>

      <div className="w-full">
        <NilaiProfilComp nilaiProfils={nilaiProfilData} isLembaga={isLembaga} />
      </div>
    </div>
  );
}
