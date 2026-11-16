import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { alumniPending, mahasiswa } from '~/server/db/schema';

import daftarProdi from './db/kode-program-studi.json';

type Database = typeof db;

/** Jurusan dan angkatan diturunkan dari 8 digit NIM (3 digit prodi + 2 digit tahun). */
export function profileFromNim(nim: number) {
  const digits = String(nim).padStart(8, '0');
  const kodeProdi = parseInt(digits.substring(0, 3));
  const jurusan =
    daftarProdi.find((item) => item.kode === kodeProdi)?.jurusan ?? 'TPB';
  // asumsi cuma ada angkatan 2000-an
  const angkatan = parseInt(digits.substring(3, 5)) + 2000;
  return { jurusan, angkatan };
}

export async function insertMahasiswa(
  id: string,
  nim: number,
  jurusan: string,
  angkatan: number,
  database: Database = db,
) {
  const mahasiswaExists = await database.query.mahasiswa.findFirst({
    where: eq(mahasiswa.userId, id),
  });
  if (mahasiswaExists) return mahasiswaExists;

  // H-03 fallback: NIM ini sudah pernah di-upload di CSV wisuda sebelum
  // akunnya pernah login sama sekali — langsung tandai alumni & bersihkan
  // pending-nya.
  const pending = await database.query.alumniPending.findFirst({
    where: eq(alumniPending.nim, nim),
  });

  const newMahasiswa = await database
    .insert(mahasiswa)
    .values({
      userId: id,
      nim: nim,
      jurusan: jurusan,
      angkatan: angkatan,
      status: pending ? 'alumni' : 'aktif',
    })
    .returning();

  if (pending) {
    await database.delete(alumniPending).where(eq(alumniPending.id, pending.id));
  }

  return newMahasiswa;
}
