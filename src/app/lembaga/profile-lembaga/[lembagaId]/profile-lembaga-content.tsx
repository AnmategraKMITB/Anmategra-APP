'use client';

import { ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
// Asset Import
import DummyFotoLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import { useState } from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
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
    <div className="w-full flex min-h-screen flex-col items-center px-6">
      {isEditMode && (
        <div className="w-full overflow-y-auto">
          <div className="max-w-7xl mx-auto py-6">
            <EditProfileLembaga
              lembagaData={lembagaData}
              isEdit={isEditMode}
              setIsEdit={setIsEditMode}
            />
          </div>
        </div>
      )}

      <div className="flex max-w-7xl w-full flex-col gap-4">
        {!isEditMode && (
          <div className="flex max-w-7xl w-full flex-col gap-4 py-6">
            <div className="flex flex-col">
              <h1 className="text-xl md:text-2xl font-semibold text-slate-600">
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
            <div className="w-full flex flex-col items-center justify-center gap-6 md:gap-x-10 py-12 transition-all duration-500 ease-in-out">
              <div className="w-full md:w-3/4 flex flex-col gap-8 items-center justify-center">
                <div className="w-full flex flex-col sm:flex-row gap-8 items-center justify-center">
                  <div className="flex-shrink-0">
                    <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full overflow-hidden bg-gray-200">
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
                  <div className="space-y-4 text-center md:text-left flex-1">
                    <div className="space-y-2">
                      <p className="text-xl md:text-3xl text-slate-600 font-semibold">
                        {lembagaData?.name}
                      </p>
                      {lembagaData?.acronym && (
                        <p className="text-base md:text-lg text-slate-400 font-medium">
                          {lembagaData.acronym}
                        </p>
                      )}
                      <p className="text-sm md:text-xl text-slate-400">
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
          <div className="flex flex-col w-full gap-4 mb-8">
            <h5 className="text-lg sm:text-xl md:text-2xl leading-[32px] font-semibold text-slate-600">
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
          <div className="flex flex-col gap-12 w-full mb-8">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-row justify-between items-center">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
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
                      className="!w-4 !h-4 text-slate-1000"
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
          <h5 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
            Kepanitiaan Terbaru
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}
