'use client';

// Library Import
// Icons Import
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { ArrowRight } from 'lucide-react';
import type { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
// Assets Import
import NoAnggota from 'public/images/miscellaneous/not-found-anggota.png';
import React from 'react';
// Components Import
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

const PAGE_SIZE = 20;

const ProfileAnggotaComp = ({
  anggota,
  session,
  kegiatanLembagaId,
  isKegiatan,
  raporVisible = false,
}: {
  anggota: {
    id: string;
    nama: string | null;
    nim: string;
    jurusan: string;
    image: string | null;
    posisi: string | null;
    divisi: string | null;
  }[];
  session?: Session | null;
  kegiatanLembagaId?: string;
  isKegiatan: boolean;
  raporVisible?: boolean;
}) => {
  const [search, setSearch] = React.useState<string>('');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const filteredAnggota = React.useMemo(
    () =>
      anggota.filter((item) => {
        const nameMatch = item.nama
          ?.toLowerCase()
          .includes(search.toLowerCase());
        const posisiMatch = item.posisi
          ?.toLowerCase()
          .includes(search.toLowerCase());
        const divisiMatch = item.divisi
          ?.toLowerCase()
          .includes(search.toLowerCase());
        return nameMatch ?? posisiMatch ?? divisiMatch;
      }),
    [anggota, search],
  );

  // Hanya sebagian anggota yang dirender (dan avatarnya diminta ke image
  // optimizer); sisanya muncul lewat tombol "Tampilkan lebih banyak".
  const visibleAnggota = filteredAnggota.slice(0, visibleCount);

  const isLembaga = session?.user.role === 'lembaga';

  return (
    <div>
      <div className="mb-4 mt-4 sm:mt-8 flex items-center justify-between">
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
          Anggota
        </h2>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Cari nama anggota"
          className="rounded-2xl bg-white focus-visible:ring-transparent placeholder:text-neutral-700"
          startAdornment={
            <MagnifyingGlassIcon className="size-4 text-gray-500" />
          }
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
        />
      </div>
      <div className="space-y-2">
        {filteredAnggota.length > 0 ? (
          visibleAnggota.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b border-neutral-200"
            >
              <Link
                href={`/profile-mahasiswa/${item.id}`}
                className="flex items-center gap-x-4"
              >
                <Image
                  src={item.image ?? '/images/placeholder/profile-pic.png'}
                  alt="Profile Picture"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover"
                  width={56}
                  height={56}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {item.nama}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    {item.nim} | {item.jurusan}
                  </p>
                  {(item.posisi || item.divisi) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[item.posisi, item.divisi].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </div>
              </Link>
              {raporVisible && (
                <Link
                  href={`/${isKegiatan ? 'profile-kegiatan' : 'profile-lembaga'}/${kegiatanLembagaId}/rapor/${item.id}`}
                  className="text-xs sm:text-sm text-emerald-600 hover:text-emerald-700 font-medium underline-offset-4 hover:underline shrink-0 ml-4"
                >
                  Rapor <ArrowRight className="inline size-4 ml-1" />
                </Link>
              )}
            </div>
          ))
        ) : (
          <div className="w-full py-16 flex flex-col items-center gap-y-4">
            <Image
              src={NoAnggota}
              alt="Tidak Ada Anggota"
              width={128}
              height={128}
            />
            <div className="w-full text-center">
              <h5 className="text-2xl font-semibold text-slate-600 text-center">
                {!!session
                  ? 'Tidak ada anggota'
                  : 'Anggota tidak dapat dilihat'}
              </h5>
              <p className="text-slate-400 text-center">
                {!!session
                  ? 'Maaf, belum ada anggota yang tercatat untuk kegiatan ini'
                  : 'Silakan login untuk melihat anggota'}
              </p>
            </div>
          </div>
        )}
        {filteredAnggota.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
            >
              Tampilkan lebih banyak ({filteredAnggota.length - visibleCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileAnggotaComp;
