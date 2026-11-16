'use client';

import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import FilterDropdown, {
  type FilterOption,
} from '~/app/_components/filter/filter-dropdown';
import { Input } from '~/components/ui/input';
import search from 'public/icons/search.svg';
import { api } from '~/trpc/react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';

import RequestTableAssociationsEntries from './request-table-associations-entries';

type PermintaanAsosiasiUser = {
  // id: string;
  image: string | null;
  user_id: string;
  mahasiswa_name: string;
  division: string;
  position: string;
};

type InboxDetailContentProps = {
  id: string;
  data: PermintaanAsosiasiUser[];
  lembagaId: string;
  isLembagaRequest: boolean;
  basePath?: string;
};

export default function InboxDetailContent({
  id,
  data: initialData,
  lembagaId,
  isLembagaRequest,
  basePath = '/lembaga/inbox',
}: InboxDetailContentProps) {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: lembagaFilteredData } = api.lembaga.getAllRequestAssociationLembaga.useQuery(
    {lembagaId, division: selectedFilters.length > 0 ? selectedFilters : undefined,},
    {enabled: isLembagaRequest && selectedFilters.length > 0,}
  );

  const { data: eventFilteredData } = api.lembaga.getAllRequestAssociation.useQuery(
    {lembagaId, event_id: id,division: selectedFilters.length > 0 ? selectedFilters : undefined,},
    {enabled: !isLembagaRequest && selectedFilters.length > 0,}
  );

  const serverData = useMemo(() => {
    if (selectedFilters.length === 0) {
      return initialData;
    }
    
    if (isLembagaRequest) {
      return lembagaFilteredData?.requests ?? initialData;
    } else {
      return eventFilteredData ?? initialData;
    }
  }, [selectedFilters, isLembagaRequest, lembagaFilteredData, eventFilteredData, initialData]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return serverData;

    return serverData.filter((item) =>
      item.mahasiswa_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [serverData, searchQuery]);

  const filterOptions: FilterOption[] = useMemo(() => {
    const uniqueDivisions = Array.from(
      new Set(
        initialData
          .map((item) => item.division)
          .filter((d): d is string => Boolean(d))
      )
    );
    return uniqueDivisions.map((division) => ({
      id: division,
      label: division,
      value: division,
    }));
  }, [initialData]);

  const handleFilterChange = useCallback((filters: string[]) => {
    setSelectedFilters(filters);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <div className="flex-1 p-4 sm:p-6 lg:p-10">
        <h1 className="m-0 mb-3 text-2xl md:text-[32px] font-semibold">
          Permintaan Asosiasi
        </h1>
        <RaporBreadcrumb
          items={[
            {label:'Permintaan Asosiasi', href: basePath},
            {label:'Detail', href: `${basePath}/${id}`}
          ]}
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center my-5 gap-4 sm:gap-4">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Cari nama pemohon"
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
              filterTitle="Divisi"
              filterOptions={filterOptions}
              selectedFilters={selectedFilters}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>

        <div>
          <RequestTableAssociationsEntries id={id} data={filteredData} lembagaId={lembagaId} basePath={basePath} />
        </div>
      </div>
    </div>
  );
}
