'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '~/trpc/react';

function defaultRoute(permissions: string[]): string {
  const can = (permission: string) =>
    permissions.includes('*') || permissions.includes(permission);
  if (can('reports.read')) return '/admin';
  if (can('accounts.read')) return '/admin/akun';
  if (can('lembaga.read')) return '/admin/lembaga';
  if (can('access.read')) return '/admin/akses';
  if (can('audit.read')) return '/admin/audit';
  return '/';
}

/**
 * Guard untuk route admin yang dibuka langsung. Layout hanya tahu bahwa user
 * punya salah satu izin; komponen ini memastikan izin untuk halaman tertentu.
 */
export function AdminGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const current = api.adminConsole.myAdminPermissions.useQuery();
  const permissions = current.data?.permissions ?? [];
  const allowed =
    permissions.includes('*') || permissions.includes(permission);

  useEffect(() => {
    if (!current.data || allowed) return;
    router.replace(defaultRoute(permissions));
  }, [allowed, current.data, permissions, router]);

  if (current.isLoading) {
    return <p className="text-sm text-neutral-700">Memeriksa akses…</p>;
  }
  if (!allowed) return null;
  return children;
}
