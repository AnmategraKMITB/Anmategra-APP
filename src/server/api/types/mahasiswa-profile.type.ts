import { z } from 'zod';

/**
 * Bentuk profil mahasiswa yang dikirim ke klien (lihat `mahasiswa-profile.ts`).
 * `email`, `lineId`, dan `whatsapp` bernilai `null` bila penonton tidak berhak
 * melihatnya. Kolom internal akun (`role`, `isDemo`, `hiddenAt`, dan lain-lain)
 * sengaja tidak ikut.
 */
export const MahasiswaProfileSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
    email: z.string().nullable(),
  }),
  mahasiswa: z.object({
    userId: z.string(),
    nim: z.number(),
    jurusan: z.string(),
    angkatan: z.number(),
    status: z.enum(['aktif', 'alumni']),
    raporVisible: z.boolean(),
    lineId: z.string().nullable(),
    whatsapp: z.string().nullable(),
    showWhatsapp: z.boolean(),
    showLine: z.boolean(),
    showEmail: z.boolean(),
  }),
});

export type MahasiswaProfileOutput = z.infer<typeof MahasiswaProfileSchema>;
