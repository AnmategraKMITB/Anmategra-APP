import daftarProdi from '~/server/db/kode-program-studi.json';

const FAKULTAS_OF_KODE = new Map(
  daftarProdi.flatMap((p) =>
    p.fakultas ? [[p.kode, p.fakultas] as const] : [],
  ),
);

/** Fakultas dari tiga digit awal NIM (kode program studi), atau null. */
export function fakultasOfNim(nim: number | string | null | undefined) {
  if (nim === null || nim === undefined) return null;
  const kode = Number(String(nim).slice(0, 3));
  return FAKULTAS_OF_KODE.get(kode) ?? null;
}
