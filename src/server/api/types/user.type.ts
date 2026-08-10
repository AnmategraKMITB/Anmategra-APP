import { create } from 'domain';
import { type InferSelectModel, desc } from 'drizzle-orm';
import { stat } from 'fs';
import { z } from 'zod';
import {
  type mahasiswa,
  supportStatusEnum,
  supportUrgentEnum,
  type users,
} from '~/server/db/schema';

type User = InferSelectModel<typeof users>;
type Mahasiswa = InferSelectModel<typeof mahasiswa>;

export const GetTambahAnggotaLembagaOptionsInputSchema = z.object({
  lembagaId: z.string(),
});

export const GetTambahAnggotaLembagaOptionsOutputSchema = z.object({
  mahasiswa: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
  nim: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
  posisi: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
  bidang: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
});

export const GetTambahAnggotaKegiatanOptionsInputSchema = z.object({
  kegiatanId: z.string(),
});

export const GetTambahAnggotaKegiatanOptionsOutputSchema = z.object({
  posisi: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
  bidang: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
    }),
  ),
});

export const EditProfilMahasiswaInputSchema = z.object({
  image: z.string().url().optional(),
  idLine: z
    .string()
    .optional()
    .refine((val) => !val || (val.length >= 3 && val.length <= 30)),
  noWhatsapp: z
    .string()
    .optional()
    .refine((val) => !val || /^0\d{10,12}$/.test(val)),
});

export const RequestAssociationInputSchema = z.object({
  event_id: z.string(),
  division: z.string(),
  position: z.string(),
});

export const RequestAssociationOutputSchema = z.object({
  success: z.boolean(),
});

export const GetMyRequestAssociationOutputSchema = z.object({
  id: z.string(),
  event_id: z.string().nullable(),
  image: z.string().url().nullable(),
  event_name: z.string().nullable(),
  position: z.string(),
  division: z.string(),
  status: z.enum(['Pending', 'Accepted', 'Declined']),
});

export const GetMyRequestAssociationLembagaOutputSchema = z.object({
  id: z.string(),
  lembaga_id: z.string().nullable(),
  image: z.string().url().nullable(),
  lembaga_name: z.string().nullable(),
  position: z.string(),
  division: z.string(),
  status: z.enum(['Pending', 'Accepted', 'Declined']),
});

export const EditRequestAssociationOutputSchema = z.object({
  // Dipake buat edit & delete
  success: z.boolean(),
  message: z.string().optional(),
});

// Delete Request Association event & lembaga input schema
export const DeleteRequestAssociationInputSchema = z.object({
  event_id: z.string(),
});

export const DeleteRequestAssociationLembagaInputSchema = z.object({
  lembaga_id: z.string(),
});

export const RequestAssociationLembagaInputSchema = z.object({
  lembaga_id: z.string(),
  division: z.string(),
  position: z.string(),
});

export const RequestAssociationLembagaOutputSchema = z.object({
  success: z.boolean(),
});

export const GetMahasiswaByIdInputSchema = z.object({
  userId: z.string(),
});

export const GetMahasiswaByNimInputSchema = z.object({
  nim: z.string(),
});

export const GetMahasiswaOutputSchema = z.object({
  mahasiswaData: z.object({
    mahasiswa: z.custom<Mahasiswa>(),
    user: z.custom<User>(),
  }),
});

export const SearchMahasiswaInputSchema = z.object({
  query: z.string(),
  lembagaId: z.string().optional(),
  eventId: z.string().optional(),
  isKegiatan: z.boolean(),
  limit: z.number().optional().default(10),
});

export const SearchMahasiswaOutputSchema = z.object({
  results: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      nim: z.string(),
    }),
  ),
});

export const GetPanitiaByIdInputSchema = z.object({
  userId: z.string(),
  kegiatanId: z.string(),
});

export const GetPanitiaOutputSchema = z.object({
  id: z.string(),
  nama: z.string(),
  nim: z.string(),
  divisi: z.string(),
  posisi: z.string(),
});

export const GetPanitiaByNameInputSchema = z.object({
  name: z.string(),
  kegiatanId: z.string(),
});

export const GetAnggotaByIdInputSchema = z.object({
  userId: z.string(),
  lembagaId: z.string(),
});

export const GetAnggotaOutputSchema = GetPanitiaOutputSchema;

export const GetAnggotaByNameInputSchema = z.object({
  name: z.string(),
  lembagaId: z.string(),
});

export const CreateDraftInputSchema = z.object({
  subject: z.string(),
  urgent: z.enum(supportUrgentEnum.enumValues),
  description: z.string(),
  attachment: z.string().optional(),
});

export const EditDraftInputSchema = z.object({
  id: z.string(),
  subject: z.string(),
  urgent: z.enum(supportUrgentEnum.enumValues),
  description: z.string(),
  attachment: z.string().optional(),
});

export const SubmitReportInputSchema = z.object({
  id: z.string(),
});

export const ReportOutputSchema = z.object({
  id: z.string(),
  subject: z.string(),
  urgent: z.enum(supportUrgentEnum.enumValues),
  description: z.string(),
  status: z.enum(supportStatusEnum.enumValues),
  attachment: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SubmitReportOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const GetAllReportsUserInputSchema = z.object({
  search: z.string().optional(),
  status: z.enum(supportStatusEnum.enumValues).optional(),
});

export const GetAllReportsUserOutputSchema = z.object({
  reports: z.array(ReportOutputSchema),
});
