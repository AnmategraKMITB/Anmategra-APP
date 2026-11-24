'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '~/components/ui/pagination';

export default function customPagination({
  currentPage,
  totalPages,
  setCurrentPage,
}: {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}) {
  const Pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) Pages.push(i);
  } else {
    Pages.push(1);
    if (currentPage > 3) Pages.push('ellipsis-left');
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage === 1) end = 3;
    if (currentPage === totalPages) start = totalPages - 2;
    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages) Pages.push(i);
    }
    if (currentPage < totalPages - 2) Pages.push('ellipsis-right');
    Pages.push(totalPages);
  }

  const UniquePages: (number | string)[] = [];
  for (const p of Pages) {
    if (!UniquePages.includes(p)) UniquePages.push(p);
  }

  const BaseClass =
    'w-[42px] h-[42px] text-lg flex items-center justify-center rounded-[8px] border border-[#C4CACE] transition-colors [&_svg]:!size-6';

  return (
    <Pagination>
      <PaginationContent className="gap-[16px]">
        <PaginationItem>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) setCurrentPage(currentPage - 1);
            }}
            className={`${BaseClass} hover:border-[#00B7B7] hover:bg-[#00B7B7] hover:text-white`}
          >
            <ChevronLeft size={24} className="text-current" />
          </PaginationLink>
        </PaginationItem>

        {UniquePages.map((item, idx) =>
          typeof item === 'string' ? (
            <PaginationItem key={item + idx}>
              <span className="flex h-[42px] w-[42px] select-none items-center justify-center">
                ...
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === currentPage}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(item);
                }}
                className={`${BaseClass} ${
                  item === currentPage
                    ? 'border-[#00B7B7] bg-[#00B7B7] text-white'
                    : 'hover:border-[#00B7B7] hover:bg-[#00B7B7] hover:text-white'
                }`}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) setCurrentPage(currentPage + 1);
            }}
            className={`${BaseClass} hover:border-[#00B7B7] hover:bg-[#00B7B7] hover:text-white`}
          >
            <ChevronRight size={24} className="text-current" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
