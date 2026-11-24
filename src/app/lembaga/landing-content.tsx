'use client';

// Library Import
// Icons Import
import { ChevronRightIcon } from '@radix-ui/react-icons';
// Auth Import
import { type Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { Button } from '~/components/ui/button';
// Components Import
// Types Import
import { type Kepanitiaan } from '~/types/kepanitiaan';

import { KepanitiaanCard } from '../_components/card/kepanitiaan-card';

export default function LandingContent({
  data,
}: {
  data: {
    kegiatanTerbaru: Kepanitiaan[];
    kegiatanTerbesar: Kepanitiaan[];
  };
  session: Session | null;
}) {
  const router = useRouter();

  return (
    <div className="flex w-full flex-col gap-4 pt-0 sm:pt-6">
      {/* Title */}
      <div className="flex flex-col gap-4">
        <h1 className="text-[32px] font-semibold text-[#141718]">Beranda</h1>
      </div>

      {/* List of Kepanitiaan */}
      <div className="flex w-full flex-col">
        {/*/!* Kepanitiaan *!/*/}
        {/*<div className="space-y-2 w-full">*/}
        {/*    <h3 className="text-left text-xl font-semibold mb-2 text-slate-600">Kepanitiaan</h3>*/}
        {/*    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 mb-4">*/}
        {/*        {data.kepanitiaanTerbaru.length !== 0 && data.kepanitiaanTerbaru.map((kepanitiaan) => (*/}
        {/*            <Link */}
        {/*                key={kepanitiaan.name} */}
        {/*                href={`/lembaga/profil-lembaga/${kepanitiaan.lembaga.id}`}*/}
        {/*            >*/}
        {/*                <KepanitiaanCard*/}
        {/*                    kepanitiaan={kepanitiaan}*/}
        {/*                />*/}
        {/*            </Link>*/}
        {/*        ))}*/}
        {/*        {!data.kepanitiaanTerbaru || data.kepanitiaanTerbaru.length === 0 && (*/}
        {/*            <div>*/}
        {/*                <p className="text-slate-600">Tidak ada kepanitiaan terbaru.</p>*/}
        {/*            </div>*/}
        {/*        )}*/}
        {/*    </div>*/}
        {/*</div>*/}
        {/* Kegiatan */}
        <div className="mt-2 w-full space-y-2">
          <div>
            <h3 className="mb-2 text-left text-2xl font-semibold text-[#141718]">
              Kepanitiaan Terbaru
            </h3>
            {/* <Link
              href="/kegiatan"
              className="flex items-center gap-1 text-lg font-semibold text-[#141718]"
            >
              <span>Lihat Semua</span>
              <ChevronRightIcon className="h-6 w-6" />
            </Link> */}
          </div>
          <div className="mb-4 pt-[18px]">
            {data.kegiatanTerbaru && data.kegiatanTerbaru.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {data.kegiatanTerbaru.map((kepanitiaan) => (
                  <Link
                    key={kepanitiaan.id}
                    href={`/profile-kegiatan/${kepanitiaan.id}`}
                  >
                    <KepanitiaanCard kepanitiaan={kepanitiaan} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Image
                  src="/images/lembaga/Group 6.png"
                  alt="Empty state"
                  width={120}
                  height={120}
                  className="mb-6"
                />
                <p className="text-[32px] font-semibold text-[#768085]">
                  Tidak ada kegiatan tersedia
                </p>
                <p className="pb-[32px] pl-[197px] pr-[197px] pt-[12px] text-2xl font-normal text-[#C4CACE]">
                  Maaf, Anda belum mencatat kegiatan yang dapat ditampilkan.
                  Tambahkan kegiatan terbarumu sekarang
                </p>
                <Button variant="dark_blue" onClick={() => router.push('#')}>
                  Tambah Kegiatan
                </Button>
              </div>
            )}
          </div>
        </div>
        {/* Kepanitiaan Terbesar */}
        {/* <div className="space-y-2 w-full">
          <h3 className="text-left text-xl font-semibold mb-2 text-slate-600">
            Kegiatan Terbesar
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 mb-4">
            {data.kegiatanTerbesar.length !== 0 &&
              data.kegiatanTerbesar.map((kepanitiaan) => (
                <Link
                  key={kepanitiaan.name}
                  href={`/lembaga/profile-kegiatan/${kepanitiaan.id}`}
                >
                  <KepanitiaanCard kepanitiaan={kepanitiaan} />
                </Link>
              ))}
            {!data.kegiatanTerbesar ||
              (data.kegiatanTerbesar.length === 0 && (
                <div>
                  <p className="text-slate-600">
                    Tidak ada Kegiatan terbesar yang dapat ditampilkan.
                  </p>
                </div>
              ))}
          </div>
        </div> */}
      </div>
    </div>
  );
}
