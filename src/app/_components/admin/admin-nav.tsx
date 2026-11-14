'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '~/lib/utils';

const LINKS = [
  ['/admin', 'Laporan', 'reports.read'],
  ['/admin/akun', 'Akun', 'accounts.read'],
  ['/admin/lembaga', 'Lembaga', 'lembaga.read'],
  ['/admin/akses', 'Akses', 'access.read'],
  ['/admin/email-terverifikasi', 'Email terverifikasi', 'accounts.write'],
  ['/admin/alumni', 'Alumni', 'alumni.write'],
  ['/admin/superadmin', 'Superadmin', 'superadmin'],
  ['/admin/audit', 'Audit', 'audit.read'],
] as const;

export function AdminNav({
  email,
  permissions,
}: {
  email: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const can = (permission: string) =>
    permissions.includes('*') || permissions.includes(permission);
  const visible = LINKS.filter(([, , permission]) => can(permission));

  return (
    <nav
      aria-label="Navigasi admin"
      className="mb-6 flex flex-wrap items-center gap-1 border-b border-neutral-400 pb-3"
    >
      {visible.map(([href, label]) => {
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
