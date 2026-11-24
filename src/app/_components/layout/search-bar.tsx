'use client';

import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { useDebounce } from '~/components/debounceHook';
import { Input } from '~/components/ui/input';
import { api } from '~/trpc/react';

type SearchBarProps = {
  role?: 'mahasiswa' | 'lembaga' | 'admin' | null;
  className?: string;
  placeholder?: string;
};

export const SearchBar = ({
  role,
  className = '',
  placeholder = 'Pencarian Lembaga, Kegiatan, atau Mahasiswa',
}: SearchBarProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 400);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch preview results
  const { data: previewData, isLoading } = api.landing.searchPreview.useQuery(
    { query: debouncedQuery },
    {
      enabled: debouncedQuery.trim().length >= 2,
      refetchOnWindowFocus: false,
    },
  );

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowPreview(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show/hide preview based on query and data
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2 && previewData) {
      setShowPreview(true);
    } else {
      setShowPreview(false);
    }
  }, [debouncedQuery, previewData]);

  const navigateToSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const encoded = encodeURIComponent(trimmed);

    if (role === 'lembaga') {
      void router.push(`/lembaga/pencarian/${encoded}`);
    } else {
      void router.push(`/mahasiswa/pencarian/${encoded}`);
    }

    setShowPreview(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      navigateToSearch();
    }
  };

  const handleLinkClick = () => {
    setShowPreview(false);
    setSearchQuery('');
  };

  const hasResults =
    previewData &&
    (previewData.mahasiswa.length > 0 ||
      previewData.lembaga.length > 0 ||
      previewData.kegiatan.length > 0);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="flex h-12 w-full items-center gap-2 rounded-full border border-[#C4CACE] bg-white px-4 py-2">
        <MagnifyingGlassIcon className="h-5 w-5 flex-shrink-0 text-gray-500" />
        <Input
          placeholder={placeholder}
          className="h-full w-full border-none bg-transparent text-base font-normal text-[#636A6D] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Preview Dropdown */}
      {showPreview && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[500px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-pulse">Mencari...</div>
            </div>
          ) : hasResults ? (
            <div className="py-2">
              {/* Mahasiswa Results */}
              {previewData.mahasiswa.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Mahasiswa
                  </div>
                  {previewData.mahasiswa.map((mahasiswa) => (
                    <Link
                      key={mahasiswa.userId}
                      href={`/profile-mahasiswa/${mahasiswa.userId}`}
                      onClick={handleLinkClick}
                      className="block px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {mahasiswa.nama}
                          </div>
                          <div className="text-sm text-gray-500">
                            {mahasiswa.nim}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Lembaga Results */}
              {previewData.lembaga.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Lembaga
                  </div>
                  {previewData.lembaga.map((lembaga) => (
                    <Link
                      key={lembaga.lembagaId}
                      href={`/profile-lembaga/${lembaga.lembagaId}`}
                      onClick={handleLinkClick}
                      className="block px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {lembaga.name}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Kegiatan Results */}
              {previewData.kegiatan.length > 0 && (
                <div className="mb-2">
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Kegiatan
                  </div>
                  {previewData.kegiatan.map((kegiatan) => (
                    <Link
                      key={kegiatan.id}
                      href={`/profile-kegiatan/${kegiatan.id}`}
                      onClick={handleLinkClick}
                      className="block px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {kegiatan.name}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* See All Results Link */}
              <div className="mt-2 border-t border-gray-200">
                <button
                  onClick={navigateToSearch}
                  className="w-full px-4 py-3 text-center text-sm font-medium text-[#00B7B7] transition-colors hover:bg-gray-50"
                >
                  Lihat Semua Hasil
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Tidak ada hasil ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  );
};
