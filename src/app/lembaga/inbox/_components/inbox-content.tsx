'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState, useEffect } from 'react';
import FilterDropdown, {
  type FilterOption,
} from '~/app/_components/filter/filter-dropdown';
import { Input } from '~/components/ui/input';
import search from 'public/icons/search.svg';
import { api } from '~/trpc/react';
import RequestTableEventsEntries from './request-table-events-entries';

type PermintaanAsosiasi = {
  id: string;
  image: string | null;
  nama: string;
  jumlah: string;
  tujuan: string;
};

type InboxContentProps = {
  entries: PermintaanAsosiasi[];
  lembagaId: string;
  basePath?: string;
};

export default function InboxContent({
  entries: initialEntries,
  lembagaId,
  basePath = '/lembaga/inbox',
}: InboxContentProps) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {data: searchData, isFetching} = api.lembaga.getAllRequestAssociationSummary.useQuery(
    {lembagaId, name: debouncedSearch},
    {enabled: debouncedSearch.length > 0,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    }
  );

  const entries = useMemo(()=> {
    if (debouncedSearch.length === 0){
      return initialEntries;
    }
    if (isFetching) {
      return [];
    }
    if (searchData) {
        return searchData.map((item)=>{
          const normtujuan=item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase() 
        : '';
        return {        
        id: item.id,
        image: item.image,
        nama: item.name,
        jumlah: item.total_requests.toString(),
        tujuan: normtujuan,
      }});
    }
    return [];
    
  }, [debouncedSearch, initialEntries, searchData, isFetching]);

  const filterOptions: FilterOption[] = useMemo(() => {
    const uniqueTujuan = Array.from(
      new Set(entries.map((item) => item.tujuan)),
    ).filter(Boolean);
    return uniqueTujuan.map((tujuan) => ({
      id: tujuan,
      label: tujuan,
      value: tujuan,
    }));
  }, [entries]);

  const filteredData = useMemo(() => {
    let filtered = entries;

    if (selectedFilters.length>0){
      const filterValue = selectedFilters[0];
      if (filterValue?.toLowerCase() == 'lembaga') {
        filtered = entries.filter((item) => item.tujuan.toLowerCase() === 'lembaga');
      } else if (filterValue == 'Kegiatan') {
        filtered = entries.filter((item) => item.tujuan.toLowerCase() !== 'lembaga');
      }
    }
    return filtered;
  }, [entries, selectedFilters]);

  const handleFilterChange = useCallback((filters: string[]) => {
    setSelectedFilters(filters);
  }, []);
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <div className="flex-1 p-4 sm:p-6 lg:p-10">
        <h1 className="m-0 mb-3 text-2xl md:text-[28px] lg:text-[32px] font-semibold">
          Permintaan Asosiasi
        </h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center mb-5 gap-4 sm:gap-[18px]">
          <div className="relative w-full sm:flex-1">
            <Input
              type="text"
              placeholder="Cari nama lembaga atau kegiatan"
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-12 border border-[#C4CACE] rounded-[20px] bg-white h-11 sm:h-12 text-[16px] sm:text-[18px] text-[#636A6D]"
            />
            <Image
              src={search}
              alt="Search Icon"
              width={20}
              height={20}
              className="absolute left-3 top-1/2 -translate-y-1/2"
            />
          </div>

          <div className="w-full sm:w-auto">
            <FilterDropdown
              filterTitle="Tujuan"
              filterOptions={filterOptions}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <RequestTableEventsEntries data={filteredData} basePath={basePath} />
        </div>
      </div>
    </div>
  );
}
