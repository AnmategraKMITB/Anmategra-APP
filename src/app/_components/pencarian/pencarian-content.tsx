'use client';

// Library Import
// Icon Import
// Session Import
import { type Session } from 'next-auth';
// Image Import
import Image from 'next/image';
import Link from 'next/link';
import NotFound from 'public/images/miscellaneous/not-found-general.png';
import dummyLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
// Dummy Asset Import
import dummyProfile from 'public/images/placeholder/profile-pic.png';
import React from 'react';
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
import LembagaCard from '~/app/_components/card/lembaga-card';
import MahasiswaCard from '~/app/_components/card/mahasiswa-card';
import { cn } from '~/lib/utils';
// Types Import
import { type Kepanitiaan } from '~/types/kepanitiaan';

const PencarianContent = ({
  session,
  data,
  searchQuery,
}: {
  session: Session | null;
  data: {
    mahasiswa: {
      userId: string;
      nama: string | null;
      nim: number;
      jurusan: string;
      image: string | null;
    }[];
    lembaga: Kepanitiaan[];
    kegiatan: Kepanitiaan[];
  };
  searchQuery?: string;
}) => {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center gap-6 overflow-hidden',
        'px-4 pt-20 sm:pt-10 md:px-6',
      )}
    >
      <div className="flex w-full max-w-7xl flex-col gap-3">
        <h1 className="text-2xl font-semibold text-slate-600">
          Hasil Pencarian
        </h1>
      </div>

      <div
        className={cn(
          'flex w-full flex-col items-center',
          session?.user.role === 'mahasiswa' && 'mt-0',
        )}
      >
        <div className="w-full max-w-7xl space-y-8">
          {data?.mahasiswa.length !== 0 && (
            <div className="w-full space-y-2">
              <h5 className="text-xl font-semibold text-slate-600">
                Mahasiswa
              </h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data?.mahasiswa.map((item) => (
                  <Link
                    key={item.userId}
                    href={'/profile-mahasiswa/' + item.userId}
                  >
                    <MahasiswaCard
                      nama={item.nama ?? ''}
                      NIM={item.nim.toString()}
                      jurusan={item.jurusan}
                      profilePicture={item.image ?? dummyProfile}
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data?.lembaga.length !== 0 && (
            <div className="w-full space-y-2">
              <h5 className="text-xl font-semibold text-slate-600">Lembaga</h5>
              <div className="flex w-full flex-col gap-y-4">
                {data?.lembaga.map((item) => (
                  <Link
                    key={item.lembaga.id}
                    href={`/profile-lembaga/${item.lembaga.id}`}
                  >
                    <LembagaCard
                      nama={item.name}
                      kategori={item.lembaga.type ?? ''}
                      deskripsi={item.description ?? ''}
                      lembagaPicture={item.image ?? dummyLembaga}
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data?.kegiatan.length !== 0 && (
            <div className="w-full space-y-2">
              <h5 className="text-xl font-semibold text-slate-600">Kegiatan</h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data?.kegiatan.map((item) => (
                  <Link key={item.name} href={`/profile-kegiatan/${item.id}`}>
                    <KepanitiaanCard kepanitiaan={item} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data?.mahasiswa.length === 0 &&
            data?.lembaga.length === 0 &&
            data?.kegiatan.length === 0 && (
              <div className="flex w-full flex-col items-center justify-center gap-6 p-12">
                <Image
                  src={NotFound}
                  alt="Not Found Icon"
                  width={128}
                  height={128}
                />
                <div className="space-y-2">
                  <p className="text-center text-2xl font-semibold text-slate-600">
                    Pencarian Tidak Ditemukan
                  </p>
                  <p className="text-center text-slate-400">
                    Kami tidak dapat menemukan hal yang Anda cari. <br />{' '}
                    Cobalah menggunakan kata kunci lainnya
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PencarianContent;
