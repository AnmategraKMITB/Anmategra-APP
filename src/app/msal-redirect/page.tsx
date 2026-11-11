'use client';

import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';
import { useEffect, useState } from 'react';

/**
 * Halaman pendaratan popup masuk OneDrive. MSAL v5 mengirim hasil login dari
 * jendela popup ke jendela utama lewat BroadcastChannel, dan itu hanya terjadi
 * bila halaman ini memanggil `broadcastResponseToMainFrame`. Tanpa halaman ini
 * popup tidak pernah selesai dan unggahan berkas selalu gagal.
 */
export default function MsalRedirectPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    broadcastResponseToMainFrame().catch(() => setFailed(true));
  }, []);

  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <p className="text-neutral-700">
        {failed
          ? 'Proses masuk OneDrive tidak dikenali. Tutup jendela ini lalu coba lagi dari formulir.'
          : 'Menyelesaikan proses masuk OneDrive…'}
      </p>
    </main>
  );
}
