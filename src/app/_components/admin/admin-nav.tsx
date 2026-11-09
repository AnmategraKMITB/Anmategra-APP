'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '~/lib/utils';

const LINKS = [
  ['/admin', 'Laporan'],
  ['/admin/akun', 'Akun'],
  ['/admin/lembaga', 'Lembaga'],
  ['/admin/akses', 'Akses'],
  ['/admin/audit', 'Audit'],
] as const;

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi admin"
      className="mb-6 flex flex-wrap items-center gap-1 border-b border-neutral-400 pb-3"
    >
      {LINKS.map(([href, label]) => {
        const active =
          href === '/admin' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
              active
                ? 'bg-primary-200 text-primary-400'
                : 'text-neutral-700 hover:bg-neutral-200',
            )}
          >
            {label}
          </Link>
        );
      })}
      <span className="ml-auto text-xs text-neutral-700">{email}</span>
    </nav>
  );
}
