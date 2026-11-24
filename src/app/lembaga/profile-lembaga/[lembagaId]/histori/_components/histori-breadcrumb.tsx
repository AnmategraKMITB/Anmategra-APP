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

interface HistoriBreadCrumbProps {
  items: BreadcrumbItemType[];
}

export function HistoriBreadCrumb({ items }: HistoriBreadCrumbProps) {
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
                    className="text-[16px] text-black underline"
                  >
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
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
