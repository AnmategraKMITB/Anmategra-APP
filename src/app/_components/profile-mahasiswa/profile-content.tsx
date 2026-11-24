'use client';

// Library Import
import { Mail } from 'lucide-react';
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
import { ContactVisibilityNotice } from '~/app/_components/profile-mahasiswa/contact-visibility-notice';
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
    <div className="flex min-h-screen w-full flex-col items-center px-4 sm:px-6">
      <div className="flex w-full max-w-7xl flex-col gap-4 py-6">
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
          <div className="flex w-full flex-col items-center justify-center gap-6 pt-12 sm:flex-row md:mb-6">
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
            <div className="flex-col items-center space-y-1 text-center sm:items-start sm:text-left">
              <p className="mb-2 text-xl font-semibold text-[#181818] md:text-2xl">
                {mahasiswaData?.user.name}
              </p>
              <p className="text-base text-neutral-600 md:text-lg">
                {mahasiswaData?.mahasiswa.nim}
              </p>
              <p className="text-base text-neutral-600 md:text-lg">
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

                {mahasiswaData?.user.email && (
                  <div className="flex items-center gap-x-2">
                    <Mail className="h-[18px] w-[18px]" aria-label="Email" />
                    <p>{mahasiswaData.user.email}</p>
                  </div>
                )}
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
        {session?.user.id === userId && !isEdit && (
          <ContactVisibilityNotice
            anyShown={
              mahasiswaData.mahasiswa.showWhatsapp ||
              mahasiswaData.mahasiswa.showLine ||
              mahasiswaData.mahasiswa.showEmail
            }
            onConfigure={() => setIsEdit(true)}
          />
        )}
        <div
          className={cn(
            'flex w-full items-center justify-center',
            isEdit ? '' : '',
            isLembagaView ? '' : 'sm:mb-8 sm:mt-6',
          )}
        >
          {session?.user.id === userId && (
            <div
              className={cn(
                'flex w-full',
                isEdit ? 'max-w-none' : 'h-[56px] max-w-[600px]',
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
                showWhatsapp={mahasiswaData.mahasiswa.showWhatsapp}
                showLine={mahasiswaData.mahasiswa.showLine}
                showEmail={mahasiswaData.mahasiswa.showEmail}
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
              <h5 className="text-xl font-semibold text-neutral-1000 md:text-2xl">
                Histori Best Staff
              </h5>

              {bestStaffData.best_staff_lembaga.length > 0 && (
                <div className="space-y-3">
                  <h6 className="text-lg font-semibold text-slate-600">
                    Lembaga
                  </h6>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
          <h5 className="text-xl font-semibold text-neutral-1000 md:text-2xl">
            Kepanitiaan
          </h5>
          {newestEvent && newestEvent.length !== 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <div className="flex w-full flex-col items-center gap-y-4 py-16">
              {session?.user.id === userId ? (
                <>
                  <div className="flex flex-col items-center gap-8 text-center sm:flex-row">
                    <Image
                      src={NoKepanitiaan}
                      alt="Tidak Ada Anggota"
                      width={128}
                      height={128}
                    />
                    <div className="max-w-[400px] text-left">
                      <h5 className="text-center text-xl font-semibold text-slate-600 md:text-left md:text-2xl">
                        Tidak Ada Informasi Kepanitiaan
                      </h5>
                      <p className="mt-2 text-center text-sm text-slate-400 md:text-left md:text-base">
                        Kami tidak dapat menemukan informasi kepanitiaan yang
                        diikuti, silahkan menambahkan jika ada
                      </p>
                    </div>
                  </div>
                  <CariKepanitiaanButton />
                </>
              ) : (
                <>
                  <div className="flex-col items-center gap-8 text-center sm:flex-row">
                    <Image
                      src={NoKepanitiaan}
                      alt="Tidak Ada Anggota"
                      width={128}
                      height={128}
                    />
                    <div className="max-w-[400px] text-left">
                      <h5 className="text-xl font-semibold text-slate-600 md:text-2xl">
                        Tidak Ada Informasi Kepanitiaan
                      </h5>
                      <p className="mt-2 text-sm text-slate-400 md:text-base">
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
            <h5 className="text-xl font-semibold text-neutral-1000 md:text-2xl">
              Lembaga
            </h5>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
