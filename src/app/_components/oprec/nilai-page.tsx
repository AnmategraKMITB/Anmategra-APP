import Link from 'next/link';
import { notFound } from 'next/navigation';

import { loadAssessableOprec } from './access';
import { NilaiView } from './nilai/nilai-view';
import { OprecTabs } from './oprec-tabs';
import { type OprecBase } from './status';

/** Halaman Nilai satu oprec; dipakai rute lembaga dan mahasiswa (penilai). */
export async function NilaiPage({
  kegiatanId,
  recruitmentId,
  basePath,
}: {
  kegiatanId: string;
  recruitmentId: string;
  basePath: OprecBase;
}) {
  const found = await loadAssessableOprec(recruitmentId);
  if (found?.recruitment.periodId !== kegiatanId) notFound();

  return (
    <div className="py-6 sm:py-8">
      {found.access.isAdmin ? (
        <Link
          href={`${basePath}/kegiatan/${kegiatanId}/oprec`}
          className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          ← Kembali ke oprec
        </Link>
      ) : null}
      <OprecTabs
        basePath={basePath}
        kegiatanId={kegiatanId}
        recruitmentId={recruitmentId}
        current="nilai"
        showPendaftar={found.access.isAdmin}
        showPenempatan={
          found.access.isAdmin || found.access.deciderDivisionIds.size > 0
        }
      />
      <div className="mt-6">
        <NilaiView recruitmentId={recruitmentId} />
      </div>
    </div>
  );
}
