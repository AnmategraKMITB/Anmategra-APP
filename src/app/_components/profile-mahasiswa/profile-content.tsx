'use client';

// Library Import
import Image from 'next/image';
import Link from 'next/link';
// Asset Import
import LineIcon from 'public/icons/line-icon-2.png';
import WhatsappIcon from 'public/icons/wa-icon.png';
import NoKepanitiaan from 'public/images/miscellaneous/not-found-kepanitiaan.png';
import React, { useState } from 'react';
import BestStaffCard from '~/app/_components/card/best-staff-card';
// Components Import
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
import LembagaCard from '~/app/_components/card/lembaga-card';
import CariKepanitiaanButton from '~/app/_components/profile-mahasiswa/cari-kepanitiaan-button';
import EditProfileDialog from '~/app/_components/profile-mahasiswa/edit-profile-dialog';
import RaporVisibilitySwitch from '~/app/_components/rapor/rapor-visibility-switch';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { cn } from '~/lib/utils';
import { type Kepanitiaan } from '~/types/kepanitiaan';

import { RaporBreadcrumb } from '../breadcrumb';
import { type ProfileMahasiswaContentProps } from './constant';

const ProfileMahasiswaContent: React.FC<ProfileMahasiswaContentProps> = ({
  session,
  userId,
  mahasiswaData,
  newestEvent,
  memberLembaga = [],
  isLembagaView = false,
  bestStaffData = null,
}) => {
  const [isEdit, setIsEdit] = useState(false);

  const baseHref = '/profile-kegiatan';

  return (
    <div className="w-full flex min-h-screen flex-col items-center px-4 sm:px-6">
      <div className="max-w-7xl flex w-full flex-col gap-4 py-6">
        {/* Title and Search */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-semibold text-neutral-1000">Beranda</h1>
          <RaporBreadcrumb
            items={[
              { label: 'Beranda', href: '/' },
              { label: 'Mahasiswa', href: `/profile-mahasiswa/${userId}` },
            ]}
          />
        </div>

        {/* Profil Mahasiswa */}
        {!isEdit && (
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-6 pt-12 md:mb-6">
            <Avatar
              className={cn(
                'rounded-full',
                isLembagaView
                  ? 'h-20 w-20 sm:h-[120px] sm:w-[120px] md:h-[180px] md:w-[180px]'
                  : 'h-52 w-52 md:h-40 md:w-40',
              )}
            >
              <AvatarImage
                src={
                  mahasiswaData?.user.image ??
                  '/images/placeholder/profile-pic.png'
                }
                alt="Foto Profil"
                className="rounded-full object-cover"
              />
              <AvatarFallback className="text-4xl">
                {mahasiswaData?.user.name
                  ?.split(' ')
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 flex-col items-center sm:items-start text-center sm:text-left">
              <p className="text-xl md:text-2xl text-[#181818] font-semibold mb-2">
                {mahasiswaData?.user.name}
              </p>
              <p className="text-base md:text-lg text-neutral-600">
                {mahasiswaData?.mahasiswa.nim}
              </p>
              <p className="text-base md:text-lg text-neutral-600">
                {mahasiswaData?.mahasiswa.jurusan} &#39;
                {mahasiswaData?.mahasiswa.angkatan}
              </p>
              <div className="flex items-center justify-start gap-x-10 pt-[18px] text-sm md:text-base">
                <div className="flex items-center gap-x-2">
                  <Image
                    src={LineIcon}
                    alt="Line Messanger Icon"
                    width={18}
                    height={18}
                  />
                  {mahasiswaData?.mahasiswa.lineId ? (
                    <p>{mahasiswaData?.mahasiswa.lineId}</p>
                  ) : (
                    <p>-</p>
                  )}
                </div>

                <div className="flex items-center gap-x-2">
                  <Image
                    src={WhatsappIcon}
                    alt="Whatsapp Messanger Icon"
                    width={18}
                    height={18}
                  />
                  {mahasiswaData?.mahasiswa.whatsapp ? (
                    <p>{mahasiswaData?.mahasiswa.whatsapp}</p>
                  ) : (
                    <p>-</p>
                  )}
                </div>
              </div>
              {session?.user.id === userId && (
                <div className="pt-4">
                  <RaporVisibilitySwitch
                    type="mahasiswa"
                    id={userId}
                    initialValue={mahasiswaData.mahasiswa.raporVisible}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <div
          className={cn(
            'flex items-center justify-center w-full',
            isEdit ? '' : '',
            isLembagaView ? '' : 'sm:mt-6 sm:mb-8',
          )}
        >
          {session?.user.id === userId && (
            <div
              className={cn(
                'w-full flex',
                isEdit ? 'max-w-none' : 'max-w-[600px] h-[56px]',
              )}
            >
              <EditProfileDialog
                image={mahasiswaData?.user.image}
                nama={mahasiswaData?.user.name ?? ''}
                nim={mahasiswaData?.mahasiswa.nim.toString() ?? ''}
                jurusan={mahasiswaData?.mahasiswa.jurusan ?? ''}
                angkatan={mahasiswaData?.mahasiswa.angkatan.toString() ?? ''}
                line={mahasiswaData?.mahasiswa.lineId ?? ''}
                whatsapp={mahasiswaData?.mahasiswa.whatsapp ?? ''}
                isEdit={isEdit}
                setIsEdit={setIsEdit}
              />
            </div>
          )}
        </div>

        {/* Histori Best Staff */}
        {bestStaffData &&
          (bestStaffData.best_staff_lembaga.length > 0 ||
            bestStaffData.best_staff_kegiatan.length > 0) && (
            <div className="space-y-6 pb-12">
              <h5 className="text-xl md:text-2xl font-semibold text-neutral-1000">
                Histori Best Staff
              </h5>

              {bestStaffData.best_staff_lembaga.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-lg font-semibold text-slate-600">
                    Lembaga
                  </h6>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {bestStaffData.best_staff_lembaga.map((item, index) => (
                      <BestStaffCard
                        key={index}
                        nama={item.lembaga_name}
                        subtitle={`${new Date(
                          item.start_date,
                        ).toLocaleDateString('id-ID', {
                          month: 'long',
                          year: 'numeric',
                        })}–${new Date(item.end_date).toLocaleDateString(
                          'id-ID',
                          {
                            month: 'long',
                            year: 'numeric',
                          },
                        )}`}
                        divisi={item.division}
                        profilePicture={mahasiswaData?.user.image}
                        targetType="lembaga"
                        targetId={item.lembaga_id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {bestStaffData.best_staff_kegiatan.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-lg font-semibold text-slate-600">
                    Kegiatan
                  </h6>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {bestStaffData.best_staff_kegiatan.map((item, index) => (
                      <BestStaffCard
                        key={index}
                        nama={item.name}
                        subtitle={`${new Date(
                          item.start_date,
                        ).toLocaleDateString('id-ID', {
                          month: 'long',
                          year: 'numeric',
                        })}–${new Date(item.end_date).toLocaleDateString(
                          'id-ID',
                          {
                            month: 'long',
                            year: 'numeric',
                          },
                        )}`}
                        divisi={item.division}
                        profilePicture={mahasiswaData?.user.image}
                        targetType="kegiatan"
                        targetId={item.event_id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Kepanitiaan */}
        <div className="space-y-4 pb-12 md:mt-[50px]">
          <h5 className="text-xl md:text-2xl font-semibold text-neutral-1000">
            Kepanitiaan
          </h5>
          {newestEvent && newestEvent.length !== 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {newestEvent.map((item: Kepanitiaan) => (
                <Link key={item.id} href={`${baseHref}/${item.id}`}>
                  <KepanitiaanCard
                    kepanitiaan={item}
                    showRaporLink={true}
                    mahasiswaId={userId}
                    raporVisible={item.raporVisible ?? false}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <div className="w-full py-16 flex flex-col items-center gap-y-4">
              {session?.user.id === userId ? (
                <>
                  <div className="text-center items-center flex flex-col sm:flex-row gap-8">
                    <Image
                      src={NoKepanitiaan}
                      alt="Tidak Ada Anggota"
                      width={128}
                      height={128}
                    />
                    <div className="max-w-[400px] text-left">
                      <h5 className="text-xl md:text-2xl font-semibold text-slate-600 md:text-left text-center">
                        Tidak Ada Informasi Kepanitiaan
                      </h5>
                      <p className="text-sm md:text-base text-slate-400 mt-2 md:text-left text-center">
                        Kami tidak dapat menemukan informasi kepanitiaan yang
                        diikuti, silahkan menambahkan jika ada
                      </p>
                    </div>
                  </div>
                  <CariKepanitiaanButton />
                </>
              ) : (
                <>
                  <div className="text-center items-center flex-col sm:flex-row gap-8">
                    <Image
                      src={NoKepanitiaan}
                      alt="Tidak Ada Anggota"
                      width={128}
                      height={128}
                    />
                    <div className="max-w-[400px] text-left">
                      <h5 className="text-xl md:text-2xl font-semibold text-slate-600">
                        Tidak Ada Informasi Kepanitiaan
                      </h5>
                      <p className="text-sm md:text-base text-slate-400 mt-2">
                        Kami tidak dapat menemukan informasi kepanitiaan yang
                        diikuti oleh mahasiswa ini
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Lembaga */}
        {memberLembaga && memberLembaga.length > 0 && (
          <div className="space-y-4 pb-12">
            <h5 className="text-xl md:text-2xl font-semibold text-neutral-1000">
              Lembaga
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {memberLembaga.map((item) => (
                <Link
                  key={item.id}
                  href={`/mahasiswa/profile-lembaga/${item.id}`}
                >
                  <LembagaCard
                    id={item.id}
                    nama={item.name}
                    kategori={item.type ?? 'Lembaga'}
                    deskripsi={item.description ?? ''}
                    lembagaPicture={item.image}
                    memberCount={item.memberCount}
                    position={item.position}
                    division={item.division}
                    variant="vertical"
                  />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileMahasiswaContent;
