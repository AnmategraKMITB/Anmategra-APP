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
  canEdit?: boolean;
};

export default function RaporIndividuHeader({
  dataNilaiProfil,
  id,
  isLembaga,
  canEdit = true,
}: HeaderDataProps) {
  const [nilaiProfilData, setNilaiProfilData] = useState<Profile[]>(
    dataNilaiProfil?.nilai ? dataNilaiProfil.nilai : [],
  );

  const upsertMutationLembaga =
    api.rapor.upsertNilaiMahasiswaLembaga.useMutation();

  const upsertMutationKegiatan =
    api.rapor.upsertNilaiMahasiswaKegiatan.useMutation();

  const handleUpdateNilaiProfilChange = (
    updatedProfiles: Profile[],
  ) => {
    setNilaiProfilData(updatedProfiles);
    if (isLembaga) {
      const upsertData = {
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
      } satisfies z.infer<typeof UpsertNilaiMahasiswaKegiatanInputSchema>;
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
    <div className="flex flex-col items-start justify-center w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start w-full mt-1 gap-2 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
        <div className="flex w-fit items-center justify-center gap-2 rounded-full bg-primary-400 px-3 py-1 text-[0.7rem] text-white">
          <Avatar className="size-4 bg-white">
            <AvatarImage
              className="object-contain"
              src={lembagaImage ?? '/images/placeholder/profile-lembaga-kegiatan.png'}
            />
            <AvatarFallback>{lembagaName.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="line-clamp-1 font-semibold">{lembagaName}</span>
        </div>

        {!isLembaga && (
          <div className="font-bold text-lg sm:text-xl md:text-2xl text-[#2B6282] items-center justify-center">
            {kegiatanName ?? ''}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-start justify-between w-full mb-8 sm:mb-12 md:mb-16 gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start gap-4 sm:gap-6 md:gap-10 w-full lg:flex-1">
          <div className="flex flex-col min-w-24 max-w-24 min-h-24 max-h-24 sm:min-w-32 sm:max-w-32 sm:min-h-32 sm:max-h-32 md:min-w-40 md:max-w-40 md:min-h-40 md:max-h-40 rounded-full overflow-hidden flex-shrink-0 relative">
            <Image
              src={
                mahasiswaOutput.data?.mahasiswaData.user.image ?? dummyProfile
              }
              alt="Profile Picture"
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start justify-start w-full min-w-0">
            <div className="flex my-1 sm:my-2 items-center justify-start">
              <div className="text-lg sm:text-xl md:text-2xl font-semibold text-[#181818] text-wrap">
                {dataNilaiProfil?.name}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-4 sm:gap-x-8 md:gap-x-[50px] gap-y-3 sm:gap-y-4 items-start justify-start mb-3 sm:mb-[18px] w-full">
              <div className="flex flex-col items-start justify-start min-w-0">
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-500">
                  NIM
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-800 text-wrap w-full">
                  {dataNilaiProfil?.nim}
                </div>
              </div>

              <div className="flex flex-col items-start justify-start min-w-0">
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-500">
                  Jurusan
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-800 text-wrap w-full">
                  {dataNilaiProfil?.jurusan}
                </div>
              </div>

              <div className="flex flex-col items-start justify-start min-w-0">
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-500">
                  Divisi
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-800 text-wrap w-full">
                  {dataNilaiProfil?.division}
                </div>
              </div>

              <div className="flex flex-col items-start justify-start min-w-0">
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-500 ">
                  Posisi
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-800 text-wrap w-full">
                  {dataNilaiProfil?.position}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start justify-start gap-3 sm:gap-8 md:gap-20 w-full">
              <div className="flex flex-row gap-[5px] items-center justify-start min-w-0">
                <div className="w-4 h-4 sm:w-[18px] sm:h-[18px] relative flex-shrink-0">
                  <Image
                    src={LineIcon}
                    alt="Line Icon"
                    width={18}
                    height={18}
                    className="w-full h-full invert opacity-60"
                    style={{ filter: 'brightness(0.5)' }}
                  />
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-600 text-wrap">
                  {dataNilaiProfil?.lineId ?? '-'}
                </div>
              </div>
              <div className="flex flex-row gap-[5px] items-center justify-start min-w-0">
                <div className="w-4 h-4 sm:w-[18px] sm:h-[18px] relative flex-shrink-0">
                  <Image
                    src={WAIcon}
                    alt="WA Icon"
                    width={18}
                    height={18}
                    className="w-full h-full invert opacity-60"
                    style={{ filter: 'brightness(0.5)' }}
                  />
                </div>
                <div className="text-sm sm:text-base md:text-[18px] text-neutral-600 text-wrap">
                  {dataNilaiProfil?.whatsapp ?? '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="w-full lg:w-auto flex-shrink-0">
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
