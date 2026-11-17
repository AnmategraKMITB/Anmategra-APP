'use client';

import { api } from '~/trpc/react';

/**
 * Hasil pendaftaran untuk pendaftar sendiri. Tidak pernah menampilkan nilai,
 * alasan, atau perbandingan; disembunyikan bila pengguna bukan pendaftar.
 */
export function ApplicantResultCard({
  recruitmentId,
}: {
  recruitmentId: string | null;
}) {
  const result = api.oprec.myResult.useQuery(
    { recruitmentId: recruitmentId ?? '' },
    { enabled: recruitmentId !== null, retry: false },
  );

  if (!recruitmentId || result.isLoading || result.isError || !result.data) {
    return null;
  }

  if (!result.data.released) {
    return (
      <section
        aria-label="Hasil pendaftaran"
        className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
      >
        <h2 className="text-base font-semibold text-neutral-1000">
          Pendaftaranmu sudah kami terima
        </h2>
        <p className="mt-1 text-sm text-neutral-700">
          Hasil akan diumumkan oleh panitia. Pantau halaman ini lagi nanti.
        </p>
      </section>
    );
  }

  const note = result.data.final ? null : (
    <p className="mt-2 text-xs text-neutral-700">
      Hasil sementara: masa banding sedang berjalan dan hasil bisa berubah.
      Hasil final diumumkan setelah penempatan final.
    </p>
  );

  if (result.data.accepted) {
    return (
      <section
        aria-label="Hasil pendaftaran"
        role="status"
        className="rounded-[20px] border border-success-dark bg-success-light p-4"
      >
        <h2 className="text-base font-semibold text-success-dark">
          Selamat, kamu diterima!
        </h2>
        <p className="mt-1 text-sm text-success-dark">
          Diterima di{' '}
          <strong>{result.data.divisionLabel ?? 'divisi tujuan'}</strong>.
        </p>
        {note}
      </section>
    );
  }

  return (
    <section
      aria-label="Hasil pendaftaran"
      role="status"
      className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
    >
      <h2 className="text-base font-semibold text-neutral-1000">
        Belum diterima
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        Terima kasih sudah mendaftar. Kamu belum diterima di oprec ini.
      </p>
      {note}
    </section>
  );
}
