import Link from 'next/link';
import React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb';

type BreadcrumbItemType = {
  label: string;
  href?: string; // If no href, it's the current page
};

interface RaporBreadcrumbProps {
  items: BreadcrumbItemType[];
}

export function RaporBreadcrumb({ items }: RaporBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, idx) => (
          <React.Fragment key={item.label + idx}>
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link
                    href={item.href}
                    className="text-sm text-black underline sm:text-base md:text-[16px]"
                  >
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-sm sm:text-base md:text-[16px]">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {idx < items.length - 1 && (
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
            )}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
