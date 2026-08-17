import { z } from 'zod';

export const GetInfoLembagaInputSchema = z.object({
  lembagaId: z.string().nonempty(),
});

export const GetInfoLembagaOutputSchema = z.object({
  id: z.string(),
  nama: z.string(),
  foto: z.string().url().nullable(),
  deskripsi: z.string().nullable(),
  tanggal_berdiri: z.date().nullable(),
  tipe_lembaga: z.string().nullable(),
  raporVisible: z.boolean().nullable(),
  detail_tambahan: z.object({
    jurusan: z.string().nullable(),
    bidang: z.string().nullable(),
    jumlah_anggota: z.number().min(0).nullable(),
  }),
});

const AnggotaLembagaSchema = z.object({
  id: z.string(),
  nama: z.string(),
  nim: z.string(),
  divisi: z.string(),
  posisi: z.string(),
});

export const GetAllAnggotaLembagaInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  namaOrNim: z.string().optional(),
  divisi: z.string().optional(),
});

export const GetAllAnggotaLembagaOutputSchema = z.array(AnggotaLembagaSchema);

const AssociationSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  user_id: z.string(),
  image: z.string().url().nullable(),
  mahasiswa_name: z.string(),
  division: z.string(),
  position: z.string(),
});

export const GetAllRequestAssociationOutputSchema = z.array(AssociationSchema);

export const GetLembagaHighlightedEventInputSchema = z.object({
  lembagaId: z.string().nonempty(),
});

export const GetLembagaHighlightedEventOutputSchema = z
  .object({
    id: z.string(),
    nama: z.string(),
    deskripsi: z.string().nullable(),
    poster: z.string().url().nullable(),
  })
  .nullable();

export const GetLembagaEventsInputSchema = z.object({
  lembagaId: z.string().nonempty(),
  page: z.number().min(1).default(1),
});

const KegiatanSchema = z.object({
  id: z.string(),
  nama: z.string(),
  deskripsi: z.string().nullable(),
  poster: z.string().url().nullable(),
  start_date: z.date(),
});

export const GetLembagaEventsOutputSchema = z.object({
  events: z.array(KegiatanSchema),
  totalPages: z.number().min(1),
});

export const AddAnggotaLembagaInputSchema = z.object({
  user_id: z.string().nonempty(),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const AddAnggotaManualLembagaInputSchema = z.object({
  name: z.string().nonempty(),
  nim: z.string().regex(/^\d{8}$/, 'NIM harus 8 digit angka'),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const AddAnggotaLembagaOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export const RemoveAnggotaLembagaInputSchema = z.object({
  user_id: z.string().nonempty(),
});

export const RemoveAnggotaLembagaOutputSchema = z.object({
  success: z.boolean(),
});

export const editAnggotaLembagaInputSchema = z.object({
  user_id: z.string().nonempty(),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const editAnggotaLembagaOutputSchema = z.object({
  success: z.boolean(),
});

// Limits track the real data: `lembaga.name` is varchar(255) (longest seeded
// name is 73 chars), `lembaga.description` is text (longest seeded is 227).
// The previous 30/100 caps rejected 62 of 135 names and 134 of 135
// descriptions, so a seeded lembaga could not save its own profile at all.
export const EditProfilLembagaInputSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, 'Nama wajib diisi')
    .max(255, 'Nama maksimal 255 karakter'),
  singkatan: z
    .string()
    .trim()
    .max(50, 'Singkatan maksimal 50 karakter')
    .optional(),
  tipe: z.enum(['Himpunan', 'UKM', 'Kepanitiaan', 'BSO']).optional(),
  deskripsi: z
    .string()
    .trim()
    .min(10, 'Deskripsi minimal 10 karakter')
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional(),
  gambar: z.string().url().optional(),
});

export const EditProfilLembagaOutputSchema = z.object({
  success: z.boolean(),
});

export const AcceptRequestAssociationInputSchema = z.object({
  event_id: z.string().nonempty(),
  user_id: z.string().nonempty(),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const AcceptRequestAssociationOutputSchema = z.object({
  success: z.boolean(),
});

export const DeclineRequestAssociationInputSchema = z.object({
  event_id: z.string().nonempty(),
  user_id: z.string().nonempty(),
});

export const DeclineRequestAssociationOutputSchema = z.object({
  success: z.boolean(),
});

export const GetBestStaffOptionsInputSchema = z.object({
  event_id: z.string().nonempty(),
  division: z.string().nonempty(),
});

export const GetBestStaffOptionsOutputSchema = z.object({
  staff_options: z.array(
    z.object({
      user_id: z.string(),
      name: z.string(),
    }),
  ),
});

export const GetAllRequestAssociationSummaryInputSchema = z.object({
  name: z.string().optional(),
});

export const GetAllRequestedAssociationSummaryOutputSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    total_requests: z.number().min(0),
    type: z.string(), // "Lembaga" or "Kegiatan"
    image: z.string().url().nullable(),
  }),
);

export const GetAllRequestAssociationKegiatanInputSchema = z.object({
  event_id: z.string().nonempty(),
  division: z.array(z.string()).optional(),
});

export const GetAllRequestAssociationInputSchema = z.object({
  division: z.array(z.string()).optional(),
});

export const GetAllRequestAssociationLembagaOutputSchema = z.object({
  requests: z.array(
    z.object({
      user_id: z.string(),
      image: z.string().url().nullable(),
      mahasiswa_name: z.string(),
      division: z.string(),
      position: z.string(),
    }),
  ),
});

export const AcceptRequestAssociationLembagaInputSchema = z.object({
  user_id: z.string().nonempty(),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const AcceptRequestAssociationLembagaOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const DeclineRequestAssociationLembagaInputSchema = z.object({
  user_id: z.string().nonempty(),
  division: z.string().nonempty(),
  position: z.string().nonempty(),
});

export const DeclineRequestAssociationLembagaOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const ChooseBestStaffKegiatanInputSchema = z.object({
  event_id: z.string().nonempty(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  best_staff_list: z.array(
    z.object({
      user_id: z.string(),
      division: z.string(),
    }),
  ),
});

export const ChooseBestStaffKegiatanOutputSchema = z.object({
  success: z.boolean(),
});

export const GetAllLembagaDivisionInputSchema = z.object({
  lembaga_id: z.string().nonempty(),
});

export const GetAllKegiatanDivisionInputSchema = z.object({
  event_id: z.string().nonempty(),
});

export const GetAllDivisionOutputSchema = z.object({
  divisions: z.array(z.string()),
});

export const GetBestStaffLembagaOptionsInputSchema = z.object({
  lembaga_id: z.string().nonempty(),
  division: z.string().nonempty(),
});

export const GetBestStaffLembagaOptionsOutputSchema = z.object({
  staff_options: z.array(
    z.object({
      user_id: z.string(),
      name: z.string(),
    }),
  ),
});

export const ChooseBestStaffLembagaInputSchema = z.object({
  lembaga_id: z.string().nonempty(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  best_staff_list: z.array(
    z.object({
      user_id: z.string(),
      division: z.string(),
    }),
  ),
});

export const ChooseBestStaffLembagaOutputSchema = z.object({
  success: z.boolean(),
});

export const DeleteBestStaffPeriodeInputSchema = z
  .object({
    lembaga_id: z.string().nonempty().optional(),
    event_id: z.string().nonempty().optional(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  })
  .refine((data) => !(data.lembaga_id && data.event_id), {
    message: 'lembaga_id dan event_id tidak boleh dikirim bersamaan',
  })
  .refine((data) => data.lembaga_id ?? data.event_id, {
    message: 'lembaga_id atau event_id wajib diisi',
  });

export const DeleteBestStaffPeriodeOutputSchema = z.object({
  success: z.boolean(),
});

export const GetLatestBestStaffKegiatanInputSchema = z.object({
  event_id: z.string().nonempty(),
});

export const GetLatestBestStaffKegiatanOutputSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  best_staff_list: z.array(
    z.object({
      user_id: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      nim: z.string(),
      jurusan: z.string(),
      division: z.string(),
    }),
  ),
});

export const GetLatestBestStaffLembagaInputSchema = z.object({
  lembaga_id: z.string().nonempty(),
});

export const GetLatestBestStaffLembagaOutputSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  best_staff_list: z.array(
    z.object({
      user_id: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      nim: z.string(),
      jurusan: z.string(),
      division: z.string(),
    }),
  ),
});

export const GetAllHistoryBestStaffKegiatanInputSchema = z.object({
  event_id: z.string().nonempty(),
});

export const GetAllHistoryBestStaffKegiatanOutputSchema = z.object({
  periode: z.array(
    z.object({
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      best_staff_list: z.array(
        z.object({
          user_id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
          nim: z.string(),
          jurusan: z.string(),
          division: z.string(),
        }),
      ),
    }),
  ),
});

export const GetAllHistoryBestStaffLembagaInputSchema = z.object({
  lembaga_id: z.string().nonempty(),
});

export const GetAllHistoryBestStaffLembagaOutputSchema = z.object({
  periode: z.array(
    z.object({
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      best_staff_list: z.array(
        z.object({
          user_id: z.string(),
          name: z.string(),
          image: z.string().nullable(),
          nim: z.string(),
          jurusan: z.string(),
          division: z.string(),
        }),
      ),
    }),
  ),
});

export const GetAllHistoryBestStaffMahasiswaInputSchema = z.object({
  mahasiswa_id: z.string().nonempty(),
});

export const GetAllHistoryBestStaffMahasiswaOutputSchema = z.object({
  best_staff_kegiatan: z.array(
    z.object({
      event_id: z.string(),
      name: z.string(),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      division: z.string(),
    }),
  ),
  best_staff_lembaga: z.array(
    z.object({
      lembaga_id: z.string(),
      lembaga_name: z.string(),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      division: z.string(),
    }),
  ),
});

export const GetPosisiBidangOptionsOutputSchema = z.object({
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

export const ToggleRaporVisibilityLembagaInputSchema = z.object({
  rapor_visible: z.boolean(),
});

export const ToggleRaporVisibilityLembagaOutputSchema = z.object({
  success: z.boolean(),
  rapor_visible: z.boolean(),
});

export const ReorderAnggotaLembagaInputSchema = z.object({
  lembaga_id: z.string(),
  user_ids: z.array(z.string()),
});

export const ReorderAnggotaLembagaOutputSchema = z.object({
  success: z.boolean(),
});

export const ReorderAnggotaKegiatanInputSchema = z.object({
  event_id: z.string(),
  user_ids: z.array(z.string()),
});

export const ReorderAnggotaKegiatanOutputSchema = z.object({
  success: z.boolean(),
});
