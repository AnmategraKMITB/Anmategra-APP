'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isOrganogramWorkspace } from '~/lib/workspace';

/** Menyembunyikan footer situs di halaman yang memakai seluruh tinggi layar. */
export function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isOrganogramWorkspace(pathname)) return null;
  return <>{children}</>;
}
