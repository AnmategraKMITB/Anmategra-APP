/**
 * Penjaga lingkungan untuk perintah destruktif demo. Reset menghapus seluruh
 * isi tabel aplikasi, jadi ia hanya boleh berjalan bila semua syarat ini benar:
 *
 * 1. `APP_ENV=demo` (dan `NEXT_PUBLIC_APP_ENV=demo` bila diisi);
 * 2. `DATABASE_URL` terisi dan menunjuk database lokal (localhost/127.0.0.1/::1)
 *    atau host/nama database yang memuat kata "demo".
 *
 * Syarat kedua melindungi dari `APP_ENV=demo` yang tidak sengaja terpasang
 * pada shell yang `DATABASE_URL`-nya menunjuk produksi.
 */
export type DemoGuardEnv = {
  APP_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  DATABASE_URL?: string;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type DemoTarget = { host: string; database: string };

/** Melempar galat bila lingkungan bukan demo; mengembalikan sasaran bila aman. */
export function assertDemoResetAllowed(env: DemoGuardEnv): DemoTarget {
  if (env.APP_ENV !== 'demo') {
    throw new Error(
      `demo:reset ditolak: APP_ENV harus "demo" (ditemukan "${env.APP_ENV ?? ''}").`,
    );
  }
  if (env.NEXT_PUBLIC_APP_ENV && env.NEXT_PUBLIC_APP_ENV !== 'demo') {
    throw new Error(
      `demo:reset ditolak: NEXT_PUBLIC_APP_ENV harus "demo" (ditemukan "${env.NEXT_PUBLIC_APP_ENV}").`,
    );
  }
  if (!env.DATABASE_URL) {
    throw new Error('demo:reset ditolak: DATABASE_URL belum diisi.');
  }

  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error('demo:reset ditolak: DATABASE_URL tidak dapat dibaca.');
  }
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  const isLocal = LOCAL_HOSTS.has(host);
  const looksDemo = host.includes('demo') || database.includes('demo');
  if (!isLocal && !looksDemo) {
    throw new Error(
      `demo:reset ditolak: database "${database}" pada host "${host}" bukan database demo atau lokal.`,
    );
  }
  return { host, database };
}
