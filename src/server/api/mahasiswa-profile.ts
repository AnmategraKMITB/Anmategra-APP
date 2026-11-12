import { eq, type SQL } from 'drizzle-orm';

import { type db } from '~/server/db';
import { mahasiswa, users } from '~/server/db/schema';

import {
  canViewHiddenAccount,
  contactAccess,
  type ContactViewer,
} from './contact';

type Database = typeof db;

/**
 * Profil mahasiswa yang aman dikirim ke klien. Hanya kolom yang dibutuhkan
 * tampilan; bidang kontak (`email`, `lineId`, `whatsapp`) berisi `null` bila
 * `viewer` tidak berhak melihatnya (lihat `contact.ts`).
 */
export type MahasiswaProfile = {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email: string | null;
  };
  mahasiswa: {
    userId: string;
    nim: number;
    jurusan: string;
    angkatan: number;
    status: 'aktif' | 'alumni';
    raporVisible: boolean;
    lineId: string | null;
    whatsapp: string | null;
    showWhatsapp: boolean;
    showLine: boolean;
    showEmail: boolean;
  };
};

/**
 * Memuat satu mahasiswa. Mengembalikan `null` bila tidak ada, atau bila akunnya
 * disembunyikan dan `viewer` tidak berhak melihatnya, sehingga akun tersembunyi
 * tidak dapat dibedakan dari akun yang tidak ada.
 */
export async function loadMahasiswaProfile(
  database: Database,
  viewer: ContactViewer,
  where: SQL | undefined,
): Promise<MahasiswaProfile | null> {
  const [row] = await database
    .select({
      userId: users.id,
      name: users.name,
      image: users.image,
      email: users.email,
      hiddenAt: users.hiddenAt,
      nim: mahasiswa.nim,
      jurusan: mahasiswa.jurusan,
      angkatan: mahasiswa.angkatan,
      status: mahasiswa.status,
      raporVisible: mahasiswa.raporVisible,
      lineId: mahasiswa.lineId,
      whatsapp: mahasiswa.whatsapp,
      showWhatsapp: mahasiswa.showWhatsapp,
      showLine: mahasiswa.showLine,
      showEmail: mahasiswa.showEmail,
    })
    .from(mahasiswa)
    .innerJoin(users, eq(mahasiswa.userId, users.id))
    .where(where)
    .limit(1);
  if (!row) return null;

  if (
    row.hiddenAt &&
    !(await canViewHiddenAccount(database, viewer, row.userId))
  ) {
    return null;
  }

  const access = await contactAccess(database, viewer, {
    userId: row.userId,
    showWhatsapp: row.showWhatsapp,
    showLine: row.showLine,
    showEmail: row.showEmail,
  });

  return {
    user: {
      id: row.userId,
      name: row.name,
      image: row.image,
      email: access.email ? row.email : null,
    },
    mahasiswa: {
      userId: row.userId,
      nim: row.nim,
      jurusan: row.jurusan,
      angkatan: row.angkatan,
      status: row.status,
      raporVisible: row.raporVisible,
      lineId: access.line ? row.lineId : null,
      whatsapp: access.whatsapp ? row.whatsapp : null,
      showWhatsapp: row.showWhatsapp,
      showLine: row.showLine,
      showEmail: row.showEmail,
    },
  };
}

export const byUserId = (userId: string) => eq(users.id, userId);
export const byNim = (nim: number) => eq(mahasiswa.nim, nim);
