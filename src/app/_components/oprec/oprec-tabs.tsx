import Link from 'next/link';
import { cn } from '~/lib/utils';

import { type OprecBase } from './status';

const TABS = [
  ['pendaftar', 'Pendaftar'],
  ['penempatan', 'Penempatan'],
  ['nilai', 'Nilai'],
] as const;

/** Sub-navigasi satu oprec; "Pendaftar" hanya untuk pengelola oprec. */
export function OprecTabs({
  basePath,
  kegiatanId,
  recruitmentId,
  current,
  showPendaftar,
  showPenempatan = false,
}: {
  basePath: OprecBase;
  kegiatanId: string;
  recruitmentId: string;
  current: 'pendaftar' | 'penempatan' | 'nilai';
  showPendaftar: boolean;
  showPenempatan?: boolean;
}) {
  const tabs = TABS.filter(
    ([id]) =>
      (id !== 'pendaftar' || showPendaftar) &&
      (id !== 'penempatan' || showPenempatan),
  );
  if (tabs.length < 2) return null;
  return (
    <nav
      aria-label="Bagian oprec"
      className="mt-6 flex gap-1 overflow-x-auto border-b border-neutral-400"
    >
      {tabs.map(([id, label]) => (
        <Link
          key={id}
          href={`${basePath}/kegiatan/${kegiatanId}/oprec/${recruitmentId}/${id}`}
          aria-current={current === id ? 'page' : undefined}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            current === id
              ? 'border-primary-400 text-primary-400'
              : 'border-transparent text-neutral-700 hover:text-neutral-1000',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
