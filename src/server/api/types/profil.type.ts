import { z } from 'zod';

const ProfilSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  profil_km_id: z.array(z.string()),
});

export const GetAllProfilKegiatanInputSchema = z.object({
  event_id: z.string(),
});

export const GetAllProfilLembagaOutputSchema = z.object({
  profil_lembaga: z.array(ProfilSchema),
});

export const GetAllProfilKegiatanOutputSchema = z.object({
  profil_kegiatan: z.array(ProfilSchema),
});

/**
 * FE-only union for components that render profil data from either source
 * (e.g. shared rapor individu views gated by an `isLembaga` prop). Not used
 * as a tRPC `.output()` contract — each endpoint returns its own exact
 * schema above.
 */
export const GetAllProfilOutputSchema = GetAllProfilLembagaOutputSchema.or(
  GetAllProfilKegiatanOutputSchema,
);

export const GetAllProfilLembagaInputSchema = z.object({
  lembaga_id: z.string(),
});

export const CreateProfilKegiatanInputSchema = z.object({
  event_id: z.string().min(1),
  name: z.string().min(1, 'Nama profil harus diisi'),
  description: z.string().min(1, 'Deskripsi profil harus diisi'),
  profil_km_id: z.array(z.string().min(1)).min(1, 'Pilih minimal satu profil KM'),
});

export const CreateProfilKegiatanOutputSchema = z.object({
  profil_id: z.string(),
  event_id: z.string(),
  name: z.string(),
  description: z.string(),
  profil_km_id: z.array(z.string()),
});

export const CreateProfilLembagaInputSchema = z.object({
  lembaga_id: z.string().min(1),
  name: z.string().min(1, 'Nama profil harus diisi'),
  description: z.string().min(1, 'Deskripsi profil harus diisi'),
  profil_km_id: z.array(z.string().min(1)).min(1, 'Pilih minimal satu profil KM'),
});

export const CreateProfilLembagaOutputSchema = z.object({
  profil_id: z.string(),
  lembaga_id: z.string(),
  name: z.string(),
  description: z.string(),
  profil_km_id: z.array(z.string()),
});

export const DeleteProfilInputSchema = z.object({ profil_id: z.string() });

export const DeleteProfilOutputSchema = z.object({ success: z.boolean() });

export const EditProfilInputSchema = z.object({
  profil_id: z.string(),
  name: z.string(),
  description: z.string(),
  profil_km_id: z.array(z.string()),
});

export const EditProfilOutputSchema = z.object({ success: z.boolean() });

const ProfilKMSchema = z.object({
  id: z.string(),
  description: z.string(),
});

export const GetAllProfilKMOutputSchema = z.object({
  profil_km: z.array(ProfilKMSchema),
});
