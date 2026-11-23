'use client';

import Image from 'next/image';
import Filter from '~/../public/icons/filter-list.svg';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

export type FilterOption = {
  id: string;
  label: string;
  value: string;
};

type FilterDropdownProps = {
  filterTitle: string;
  filterOptions: FilterOption[];
  selectedFilters: string[];
  onFilterChange: (filters: string[]) => void;
  placeholder?: string;
};

export default function FilterDropdown({
  filterTitle,
  filterOptions,
  selectedFilters,
  onFilterChange,
}: FilterDropdownProps) {
  const handleFilterToggle = (value: string, checked: boolean) => {
    if (checked) {
      onFilterChange([...selectedFilters, value]);
    } else {
      onFilterChange(selectedFilters.filter((filter) => filter !== value));
    }
  };

  const handleClearAll = () => {
    onFilterChange([]);
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button className="flex items-center gap-2 rounded-[24px] border border-neutral-400 bg-neutral-50 px-4 py-3 text-black shadow-none hover:bg-neutral-300">
          <Image src={Filter} alt="Filter icon" width={24} height={24} />
          Filter
          {selectedFilters.length > 0 && (
            <span className="ml-1 rounded-full bg-[#00B7B7] px-2 py-0.5 text-sm text-white">
              {selectedFilters.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{filterTitle}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {filterOptions.length === 0 ? (
          <div className="px-2 py-2 text-sm text-gray-500">
            Tidak ada opsi filter
          </div>
        ) : (
          <>
            {filterOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={selectedFilters.includes(option.value)}
                onCheckedChange={(checked) =>
                  handleFilterToggle(option.value, checked)
                }
                onSelect={(e) => e.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            {selectedFilters.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleClearAll}
                  className="w-full cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600"
                >
                  Hapus semua filter
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
