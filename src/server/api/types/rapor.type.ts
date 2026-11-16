import { z } from 'zod';

export const GetAllNilaiProfilKegiatanInputSchema = z.object({
  event_id: z.string(),
});

export const GetAllNilaiProfilKegiatanOutputSchema = z.object({
  mahasiswa: z.array(
    z.object({
      user_id: z.string(),
      name: z.string(),
      nim: z.string(),
      nilai: z.array(
        z.object({
          profil_id: z.string(),
          nilai: z.number(),
        }),
      ),
    }),
  ),
});

export const GetNilaiKegiatanIndividuInputSchema = z.object({
  event_id: z.string(),
  mahasiswa_id: z.string(),
});
export const GetNilaiKegiatanIndividuOutputSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  nim: z.string(),
  jurusan: z.string(),
  lineId: z.string(),
  whatsapp: z.string(),
  division: z.string(),
  position: z.string(),
  nilai: z.array(
    z.object({
      profil_id: z.string(),
      profil_name: z.string(),
      nilai: z.number(),
    }),
  ),
});

export const UpsertNilaiMahasiswaKegiatanInputSchema = z.object({
  event_id: z.string(),
  mahasiswa: z.array(
    z.object({
      user_id: z.string(),
      nilai: z.array(
        z.object({
          profil_id: z.string(),
          nilai: z.number().min(0).max(100),
        }),
      ),
    }),
  ),
});

export const UpsertNilaiMahasiswaKegiatanOutputSchema = z.object({
  success: z.boolean(),
});

export const GetAllNilaiProfilLembagaInputSchema = z.object({
  lembagaId: z.string().nonempty(),
});

export const GetAllNilaiProfilLembagaOutputSchema =
  GetAllNilaiProfilKegiatanOutputSchema;

export const GetNilaiLembagaIndividuInputSchema = z.object({
  lembaga_id: z.string(),
  mahasiswa_id: z.string(),
});

/** Varian ber-Scope untuk pengelola; versi `lembaga_id` dipakai prosedur publik. */
export const GetNilaiLembagaIndividuManageInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  mahasiswa_id: z.string(),
});

export const GetNilaiLembagaIndividuOutputSchema =
  GetNilaiKegiatanIndividuOutputSchema;

export const UpsertNilaiMahasiswaLembagaInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  mahasiswa: z.array(
    z.object({
      user_id: z.string(),
      nilai: z.array(
        z.object({
          profil_id: z.string(),
          nilai: z.number().min(0).max(100),
        }),
      ),
    }),
  ),
});

export const UpsertNilaiMahasiswaLembagaOutputSchema =
  UpsertNilaiMahasiswaKegiatanOutputSchema;
