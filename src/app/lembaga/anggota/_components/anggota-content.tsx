'use client';

import { type Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Rapor from '~/../public/icons/assessment.svg';
import Best from '~/../public/icons/best.svg';
import SearchIcon from '~/../public/icons/search.svg';
// Import the magnifying glass icon
import FilterDropdown, {
  type FilterOption,
} from '~/app/_components/filter/filter-dropdown';
import { type Member } from '~/app/_components/form/action-cell';
import { type comboboxDataType } from '~/app/_components/form/tambah-edit-anggota-form';
import { TambahAnggotaDialog } from '~/app/lembaga/_components/tambah-anggota-dialog';
import { MahasiswaCardTable } from '~/app/lembaga/anggota/_components/table/mahasiswa-card-table';
import { Button } from '~/components/ui/button';
import { toast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

import { Download, Edit, Network, Save } from 'lucide-react';

interface AnggotaContentProps {
  session: Session | null;
  data: Member[];
  dataPosisiBidang: {
    posisi: comboboxDataType[];
    bidang: comboboxDataType[];
  };
  pageAnggota?: boolean;
  title: string;
}

export default function AnggotaContent({
  session,
  data,
  dataPosisiBidang,
  pageAnggota,
  title,
  }: AnggotaContentProps) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [reorderedUserIds, setReorderedUserIds] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pathname = usePathname();
  const isAnggota = pageAnggota ?? false;
  const eventId = !isAnggota && pathname ? pathname.split('/')[3] : undefined;
  const lembagaId = session?.user.lembagaId ?? undefined;

  const reorderLembagaMutation = api.lembaga.reorderAnggotaLembaga.useMutation({
    onSuccess: () => {
      toast({
        title: 'Berhasil menyimpan urutan anggota',
      });
      setIsEditMode(false);
      setReorderedUserIds(null);
      setIsSaving(false);
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: 'Gagal menyimpan urutan anggota',
        description: error.message,
        variant: 'destructive',
      });
      setIsSaving(false);
    },
  });

  const reorderKegiatanMutation = api.lembaga.reorderAnggotaKegiatan.useMutation({
    onSuccess: () => {
      toast({
        title: 'Berhasil menyimpan urutan anggota',
      });
      setIsEditMode(false);
      setReorderedUserIds(null);
      setIsSaving(false);
      window.location.reload();
    },
    onError: (error) => {
      toast({
        title: 'Gagal menyimpan urutan anggota',
        description: error.message,
        variant: 'destructive',
      });
      setIsSaving(false);
    },
  });

  const filterOptions: FilterOption[] = useMemo(
    () =>
      dataPosisiBidang.bidang.map((bidang) => ({
        id: bidang.value,
        label: bidang.label,
        value: bidang.value,
      })),
    [dataPosisiBidang.bidang],
  );

  const hasActiveFilters = searchQuery.trim() !== '' || selectedFilters.length > 0;

  useEffect(() => {
    if (hasActiveFilters && isEditMode) {
      setIsEditMode(false);
      setReorderedUserIds(null);
      toast({
        title: 'Mode edit dinonaktifkan',
        description: 'Hapus filter untuk mengedit urutan anggota',
      });
    }
  }, [hasActiveFilters, isEditMode]);

  const handleSaveOrder = useCallback(async () => {
    setIsEditMode(false);
    if (!reorderedUserIds) return;
    
    if (isAnggota) {
      if (!lembagaId) return;
      
      setIsSaving(true);
      reorderLembagaMutation.mutate({
        lembaga_id: lembagaId,
        user_ids: reorderedUserIds,
      });
    } else {
      if (!eventId) return;
      
      setIsSaving(true);
      reorderKegiatanMutation.mutate({
        event_id: eventId,
        user_ids: reorderedUserIds,
      });
    }
  }, [isAnggota, lembagaId, eventId, reorderedUserIds, reorderLembagaMutation, reorderKegiatanMutation, data.length]);

  const handleReorder = useCallback((newOrder: Member[]) => {
    setReorderedUserIds(newOrder.map(member => member.id));
  }, []);

  const handleFilterChange = useCallback((filters: string[]) => {
    setSelectedFilters(filters);
  }, []);


  const handleExport = async () => {
    try {
      const endpoint = isAnggota
        ? `/api/lembaga/${session?.user.lembagaId}/anggota`
        : `/api/lembaga/kegiatan/${eventId}/anggota`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anggota-${isAnggota ? 'lembaga' : 'kegiatan'}-${isAnggota ? lembagaId : eventId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({
          title: 'Rapor berhasil diekspor',
        });
      } else {
        const result = (await response.json()) as {
          message?: string;
          data?: any;
          error?: string;
          details?: string;
        };
        toast({
          title: 'Gagal mengekspor rapor',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Gagal mengekspor rapor',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="flex flex-col p-4 sm:p-6 md:p-8 min-h-screen">
      <h1 className="text-2xl sm:text-3xl md:text-[32px] font-semibold mb-2">
        {isAnggota ? 'Anggota' : 'Panitia Kegiatan'}
        {' '}
        {title}
      </h1>
      <div className="mb-4" />

      {/* Search Bar */}
      <div className="relative">
        <Image
          src={SearchIcon}
          alt="Search"
          width={16}
          height={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#636A6D]"
        />
        <input
          className="hover:border-black-300 text-md h-10 w-full rounded-3xl border border-[#C4CACE] bg-white py-6 pl-10 pr-4 focus:outline-none [&::-webkit-search-cancel-button]:cursor-pointer"
          placeholder="Cari nama anggota"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="mb-6" />

      <div className="flex flex-col flex-1">
        <div className="flex-1">
          {/* Button Section */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-x-5">
              <TambahAnggotaDialog
                session={session}
                dataPosisiBidang={dataPosisiBidang}
                pageAnggota={isAnggota}
              />
              <Link
                href={
                  isAnggota ? '/anggota/rapor' : `/kegiatan/${eventId}/rapor`
                }
              >
                <Button
                  variant="light_blue"
                  className="rounded-[16px] px-3 shadow-none flex items-center gap-2"
                >
                  <Image
                    src={Rapor}
                    alt="Rapor Komunal"
                    width={24}
                    height={24}
                  />
                  Rapor Komunal
                </Button>
              </Link>
              <Link
                href={
                  isAnggota
                    ? '/anggota/histori'
                    : `/lembaga/profile-kegiatan/${eventId}/histori`
                }
              >
                <Button
                  variant="light_blue"
                  className="rounded-[16px] px-3 shadow-none flex items-center gap-2"
                >
                  <Image
                    src={Best}
                    alt="Pilih Best Staff"
                    width={24}
                    height={24}
                  />
                  Pilih Best Staff
                </Button>
              </Link>
              {!isAnggota && eventId ? (
                <Link href={`/lembaga/kegiatan/${eventId}/organogram`}>
                  <Button
                    variant="light_blue"
                    className="rounded-[12px] px-3 shadow-none flex items-center gap-2"
                  >
                    <Network className="size-5" />
                    Organogram
                  </Button>
                </Link>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-x-2">
              <Button
                onClick={() => {
                  if (isEditMode) {
                    handleSaveOrder();
                  } else {
                    setIsEditMode(true);
                  }
                }}
                variant={isEditMode ? 'dark_blue' : 'outline'}
                className="flex items-center gap-2"
                disabled={isSaving || hasActiveFilters}
                title={hasActiveFilters ? 'Hapus filter untuk mengedit urutan' : ''}
              >
                {isEditMode ? (
                  <>
                    <Save size={20} />
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                  </>
                ) : (
                  <>
                    <Edit size={20} />
                    Edit
                  </>
                )}
              </Button>
              <FilterDropdown
                filterTitle="Bidang"
                filterOptions={filterOptions}
                selectedFilters={selectedFilters}
                onFilterChange={handleFilterChange}
              />
              <Button
              onClick={handleExport}
              variant={'dark_blue'}
            >
              <Download size={24} />
              Unduh
            </Button>
            </div>
          </div>

          {/* Table Section */}
          <MahasiswaCardTable
            data={data}
            lembagaId={lembagaId}
            eventId={eventId}
            session={session}
            posisiBidangData={dataPosisiBidang}
            isKegiatan={!isAnggota}
            isEditMode={isEditMode}
            onReorder={handleReorder}
            searchQuery={searchQuery}
            selectedFilters={selectedFilters}
          />
        </div>
      </div>
    </main>
  );
}
