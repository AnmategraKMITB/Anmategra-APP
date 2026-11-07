'use client';

import dynamic from 'next/dynamic';

/**
 * Renderer yang hanya jalan di peramban. Draf dibaca dari localStorage dan
 * urutan pilihan diacak saat render pertama; bila dirender di server, HTML
 * server dan klien berbeda (hydration mismatch).
 */
export const ClientFormRenderer = dynamic(
  () => import('./form-renderer').then((m) => m.FormRenderer),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="py-10 text-center text-neutral-700">
        Memuat form…
      </p>
    ),
  },
);
