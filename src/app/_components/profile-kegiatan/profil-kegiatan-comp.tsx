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
      <div className="mb-4 mt-4 flex items-center justify-between sm:mt-8">
        <h2 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
          Anggota
        </h2>
      </div>
      <div className="mb-4">
        <Input
          placeholder="Cari nama anggota"
          className="rounded-2xl bg-white placeholder:text-neutral-700 focus-visible:ring-transparent"
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
              className="flex items-center justify-between border-b border-neutral-200 py-3"
            >
              <Link
                href={`/profile-mahasiswa/${item.id}`}
                className="flex items-center gap-x-4"
              >
                <Image
                  src={item.image ?? '/images/placeholder/profile-pic.png'}
                  alt="Profile Picture"
                  className="h-12 w-12 rounded-full object-cover sm:h-14 sm:w-14"
                  width={56}
                  height={56}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
                    {item.nama}
                  </h3>
                  <p className="text-xs text-slate-500 sm:text-sm">
                    {item.nim} | {item.jurusan}
                  </p>
                  {(item.posisi || item.divisi) && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {[item.posisi, item.divisi].filter(Boolean).join(' | ')}
                    </p>
                  )}
                </div>
              </Link>
              {raporVisible && (
                <Link
                  href={`/${isKegiatan ? 'profile-kegiatan' : 'profile-lembaga'}/${kegiatanLembagaId}/rapor/${item.id}`}
                  className="ml-4 shrink-0 text-xs font-medium text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline sm:text-sm"
                >
                  Rapor <ArrowRight className="ml-1 inline size-4" />
                </Link>
              )}
            </div>
          ))
        ) : (
          <div className="flex w-full flex-col items-center gap-y-4 py-16">
            <Image
              src={NoAnggota}
              alt="Tidak Ada Anggota"
              width={128}
              height={128}
            />
            <div className="w-full text-center">
              <h5 className="text-center text-2xl font-semibold text-slate-600">
                {!!session
                  ? 'Tidak ada anggota'
                  : 'Anggota tidak dapat dilihat'}
              </h5>
              <p className="text-center text-slate-400">
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
