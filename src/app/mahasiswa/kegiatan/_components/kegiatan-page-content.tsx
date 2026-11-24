'use client';

import { useMemo, useState } from 'react';
import FilterDropdown, {
  type FilterOption,
} from '~/app/_components/filter/filter-dropdown';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

import KegiatanList from './kegiatan-list';

const STATUS_OPTIONS: FilterOption[] = [
  { id: 'coming-soon', label: 'Coming Soon', value: 'Coming Soon' },
  { id: 'on-going', label: 'On going', value: 'On going' },
  { id: 'ended', label: 'Ended', value: 'Ended' },
  {
    id: 'open-recruitment',
    label: 'Open Recruitment',
    value: 'Open Recruitment',
  },
];

const SORT_OPTIONS = [
  { label: 'Terbaru', value: 'newest' },
  { label: 'Terlama', value: 'oldest' },
  { label: 'Peserta Terbanyak', value: 'most_participants' },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]['value'];
type EventStatus = 'Coming Soon' | 'On going' | 'Ended' | 'Open Recruitment';

const KegiatanPageContent = () => {
  const [selectedStatus, setSelectedStatus] = useState<EventStatus[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const statusFilters = useMemo(
    () => selectedStatus.filter(Boolean),
    [selectedStatus],
  );

  const handleStatusChange = (filters: string[]) => {
    setSelectedStatus(filters as EventStatus[]);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex min-h-screen w-full flex-col items-center">
        <div className="w-full max-w-6xl rounded-none bg-slate-50 py-6 sm:rounded-xl">
          <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:px-2">
            <div>
              <h1 className="text-[28px] font-semibold text-black sm:text-[32px]">
                Kegiatan
              </h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <FilterDropdown
                filterTitle="Status Kegiatan"
                filterOptions={STATUS_OPTIONS}
                selectedFilters={statusFilters}
                onFilterChange={handleStatusChange}
              />
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <SelectTrigger className="w-full rounded-[24px] border border-neutral-400 bg-neutral-50 px-4 py-3 text-black sm:w-[220px]">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="px-1 sm:px-2">
            <KegiatanList selectedStatus={statusFilters} sortBy={sortBy} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KegiatanPageContent;
