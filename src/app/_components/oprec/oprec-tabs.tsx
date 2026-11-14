import { count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { cn } from '~/lib/utils';
import { db } from '~/server/db';
import { application, recruitment } from '~/server/db/schema';

import { OprecManageBar } from './manage-bar';
import { type OprecBase, placementLockReason } from './status';

const TABS = [
  ['pendaftar', 'Pendaftar'],
  ['nilai', 'Nilai'],
  ['penempatan', 'Penempatan'],
  ['hasil', 'Hasil'],
  ['pengaturan', 'Pengaturan'],
] as const;

export type OprecTabId = (typeof TABS)[number][0];

/**
 * Sub-navigasi satu oprec, urut alur kerja: nilai dulu, baru penempatan.
 * "Pendaftar" dan "Pengaturan" hanya untuk pengelola oprec (`manage`).
 */
export async function OprecTabs({
  basePath,
  kegiatanId,
  recruitmentId,
  current,
  showPendaftar,
  showPenempatan = false,
  showHasil = false,
  manage,
}: {
  basePath: OprecBase;
  kegiatanId: string;
  recruitmentId: string;
  current: OprecTabId;
  showPendaftar: boolean;
  showPenempatan?: boolean;
  showHasil?: boolean;
  /** Aksi pengelola (Formulir, Buka pendaftaran); hanya untuk pengelola oprec. */
  manage?: { formId: string; status: 'draft' | 'open' | 'closed' };
}) {
  const tabs = TABS.filter(
    ([id]) =>
      (id !== 'pendaftar' || showPendaftar) &&
      (id !== 'penempatan' || showPenempatan) &&
      (id !== 'hasil' || showHasil) &&
      (id !== 'pengaturan' || !!manage),
  );
  const [row] = await db
    .select({ status: recruitment.status })
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  const [applicants] = await db
    .select({ n: count() })
    .from(application)
    .where(eq(application.recruitmentId, recruitmentId));
  const lock = row ? placementLockReason(row.status, applicants?.n ?? 0) : null;
  const nav =
    tabs.length < 2 ? null : (
      <nav
        aria-label="Bagian oprec"
        className="mt-6 flex flex-wrap gap-1 border-b border-neutral-400"
      >
        {tabs.map(([id, label]) =>
          id === 'penempatan' && lock ? (
            <span
              key={id}
              aria-disabled="true"
              title={lock}
              className="-mb-px cursor-not-allowed whitespace-nowrap border-b-2 border-transparent px-4 py-2 text-sm font-semibold text-neutral-500"
            >
              {label}
              <span className="sr-only"> ({lock})</span>
            </span>
          ) : (
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
          ),
        )}
      </nav>
    );
  return (
    <>
      {manage ? (
        <OprecManageBar
          basePath={basePath}
          recruitmentId={recruitmentId}
          {...manage}
        />
      ) : null}
      {nav}
    </>
  );
}
