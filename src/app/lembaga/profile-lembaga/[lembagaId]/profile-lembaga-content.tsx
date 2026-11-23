'use client';

import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
// Asset Import
import DummyFotoLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import { useState } from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
import KelolaAdminButton from '~/app/_components/kelola-admin/kelola-admin-button';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import EditProfileLembaga from '~/app/lembaga/profile-lembaga/_components/edit-profil-lembaga';
import { Button } from '~/components/ui/button';

import CarouselBestStaff from '../../../_components/carousel/carousel-best-staff';
import HighlightedEventCard from '../_components/highlighted-event-card';

export default function ProfileLembagaContent({
  lembagaId,
  session,
  lembagaData,
  newestEvent,
  highlightedEvent,
  anggota,
  latestBestStaff,
  isLembaga,
}: {
  lembagaId: string;
  session: any;
  lembagaData: any;
  newestEvent: any;
  highlightedEvent: any;
  anggota: any;
  latestBestStaff: any;
  isLembaga: boolean;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const is_user_owner = lembagaData?.users.id === session?.user?.id;

  return (
    <div className="flex min-h-screen w-full flex-col items-center px-6">
      {isEditMode && (
        <div className="w-full overflow-y-auto">
          <div className="mx-auto max-w-7xl py-6">
            <EditProfileLembaga
              lembagaData={lembagaData}
              isEdit={isEditMode}
              setIsEdit={setIsEditMode}
            />
          </div>
        </div>
      )}

      <div className="flex w-full max-w-7xl flex-col gap-4">
        {!isEditMode && (
          <div className="flex w-full max-w-7xl flex-col gap-4 py-6">
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-slate-600 md:text-2xl">
                {lembagaData?.name}
              </h1>
              <RaporBreadcrumb
                items={[
                  { label: 'Beranda', href: '/' },
                  {
                    label: 'Profil Lembaga',
                    href: `/profile-lembaga/${lembagaId}`,
                  },
                ]}
              />
            </div>
            <div className="flex w-full flex-col items-center justify-center gap-6 py-12 transition-all duration-500 ease-in-out md:gap-x-10">
              <div className="flex w-full flex-col items-center justify-center gap-8 md:w-3/4">
                <div className="flex w-full flex-col items-center justify-center gap-8 sm:flex-row">
                  <div className="flex-shrink-0">
                    <div className="relative h-32 w-32 overflow-hidden rounded-full bg-gray-200 sm:h-40 sm:w-40 md:h-48 md:w-48 lg:h-56 lg:w-56">
                      <Image
                        src={lembagaData?.users.image ?? DummyFotoLembaga}
                        alt="Foto Lembaga"
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, (max-width: 1024px) 192px, 224px"
                        priority
                      />
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-slate-600 md:text-3xl">
                        {lembagaData?.name}
                      </p>
                      {lembagaData?.acronym && (
                        <p className="text-base font-medium text-slate-400 md:text-lg">
                          {lembagaData.acronym}
                        </p>
                      )}
                      <p className="text-sm text-slate-400 md:text-xl">
                        {lembagaData?.description}
                      </p>
                    </div>
                  </div>
                </div>
                {is_user_owner && (
                  <EditProfileLembaga
                    lembagaData={lembagaData}
                    isEdit={false}
                    setIsEdit={setIsEditMode}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Highlighted Event */}
        {highlightedEvent && (
          <div className="mb-8 flex w-full flex-col gap-4">
            <h5 className="text-lg font-semibold leading-[32px] text-slate-600 sm:text-xl md:text-2xl">
              Highlighted Event
            </h5>

            <HighlightedEventCard
              event={highlightedEvent}
              lembagaData={lembagaData}
            />
          </div>
        )}

        {/* Best Staff Section */}
        {latestBestStaff && (
          <div className="mb-8 flex w-full flex-col gap-12">
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-row items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
                  Best Staff Periode{' '}
                  {new Date(latestBestStaff.start_date).toLocaleDateString(
                    'id-ID',
                    {
                      month: 'long',
                      year: 'numeric',
                    },
                  )}
                  –
                  {new Date(latestBestStaff.end_date).toLocaleDateString(
                    'id-ID',
                    {
                      month: 'long',
                      year: 'numeric',
                    },
                  )}
                </h2>
                <Button asChild variant="ghost">
                  <Link
                    href={`/lembaga/profile-lembaga/${lembagaId}/histori`}
                    className="flex items-center gap-2 text-lg"
                  >
                    <span>Lihat Histori </span>
                    <ChevronRight
                      className="text-slate-1000 !h-4 !w-4"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
              <CarouselBestStaff
                bestStaffList={latestBestStaff.best_staff_list}
                isLembaga={isLembaga}
              />
            </div>
          </div>
        )}

        {/* Kepanitiaan Terbaru */}
        <div className="space-y-4">
          <h5 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
            Kepanitiaan Terbaru
          </h5>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newestEvent && newestEvent.length !== 0 ? (
              newestEvent.map((item) => (
                <Link href={`/profile-kegiatan/${item.id}`} key={item.id}>
                  <KepanitiaanCard kepanitiaan={item} />
                </Link>
              ))
            ) : (
              <p className="text-slate-600">Belum ada kepanitiaan</p>
            )}
          </div>
        </div>
        <ProfileAnggotaComp
          anggota={anggota ?? []}
          session={session}
          kegiatanLembagaId={lembagaId}
          raporVisible={lembagaData?.raporVisible ?? false}
          isKegiatan={false}
        />
        <KelolaAdminButton
          href={`/lembaga/profile-lembaga/${lembagaId}/kelola-admin`}
          lembagaId={lembagaId}
        />
      </div>
    </div>
  );
}
