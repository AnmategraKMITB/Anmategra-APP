/**
 * Penyusun tab ekspor Oprec. Data diambil lewat prosedur yang sama dengan
 * halaman-halamannya (Pendaftar, Nilai, Prioritas, Penempatan, Hasil), jadi
 * hak akses ikut diperiksa di sana; bagian yang tidak boleh dibuka pengekspor
 * dilewati di ekspor lengkap.
 */
import { type SheetCell, type SheetTable } from '~/lib/spreadsheet/workbook';
import { type createCaller } from '~/server/api/root';
import { formatWib } from '~/server/api/routers/form/csv';
import {
  PROVISIONAL_BANNER,
  applicantTable,
} from '~/server/api/routers/oprec/applicants-export';
import { templateTable } from '~/server/api/routers/oprec/priority-sheet';
import {
  APPLICANTS_MAX_PAGE_SIZE,
  RESULTS_MAX_PAGE_SIZE,
} from '~/server/api/types/oprec.type';

type Caller = ReturnType<typeof createCaller>;
type Outputs<K extends keyof Caller['oprec']> = Awaited<
  ReturnType<Caller['oprec'][K]>
>;

export type Contact = Outputs<'exportContacts'>[number];
export type ContactMap = Map<string, Contact>;

// ---------------------------------------------------------------------------
// Pengambilan data (semua halaman)
// ---------------------------------------------------------------------------

export async function loadApplicants(api: Caller, recruitmentId: string) {
  const rows: Outputs<'applicants'>['rows'] = [];
  for (let page = 1; ; page++) {
    const data = await api.oprec.applicants({
      recruitmentId,
      sort: 'gelombang',
      page,
      pageSize: APPLICANTS_MAX_PAGE_SIZE,
    });
    rows.push(...data.rows);
    if (rows.length >= data.total || data.rows.length === 0) break;
  }
  return rows;
}

export async function loadResults(api: Caller, recruitmentId: string) {
  const rows: Outputs<'resultsList'>['rows'] = [];
  for (let page = 1; ; page++) {
    const data = await api.oprec.resultsList({
      recruitmentId,
      page,
      pageSize: RESULTS_MAX_PAGE_SIZE,
    });
    rows.push(...data.rows);
    if (rows.length >= data.total || data.rows.length === 0) break;
  }
  return rows;
}

export async function loadContacts(
  api: Caller,
  recruitmentId: string,
): Promise<ContactMap> {
  const rows = await api.oprec.exportContacts({ recruitmentId });
  return new Map(rows.map((row) => [row.applicationId, row]));
}

const PLACEMENT_PAGE = 100;

/** Baris Penempatan untuk setiap divisi yang keputusannya dipegang pemanggil. */
export async function loadPlacement(api: Caller, recruitmentId: string) {
  const overview = await api.oprec.placementOverview({ recruitmentId });
  const divisions: {
    id: string;
    label: string;
    rows: Outputs<'placementRows'>['rows'];
  }[] = [];
  for (const division of overview.divisions.filter((d) => d.canDecide)) {
    const rows: Outputs<'placementRows'>['rows'] = [];
    for (let page = 1; ; page++) {
      const data = await api.oprec.placementRows({
        recruitmentId,
        divisionId: division.id,
        page,
        pageSize: PLACEMENT_PAGE,
      });
      rows.push(...data.rows);
      if (rows.length >= data.total || data.rows.length === 0) break;
    }
    divisions.push({ id: division.id, label: division.label, rows });
  }
  return divisions;
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

const ASSESS_STATUS: Record<string, string> = {
  belum_lengkap: 'Belum lengkap',
  perlu_ditinjau: 'Perlu ditinjau',
  lolos: 'Lolos',
  tidak_lolos: 'Tidak lolos',
};

const STAGE: Record<string, string> = {
  aktif: 'Aktif',
  menunggu: 'Menunggu pilihan sebelumnya',
  tertutup: 'Tertutup',
};

const DECISION: Record<string, string> = {
  terima: 'Diterima',
  tolak: 'Ditolak',
};

const TAG: Record<string, string> = {
  pindahan: 'Pindahan',
  lewat_banding: 'Lewat banding',
  di_luar_pilihan: 'Di luar pilihan',
};

const ORIGIN: Record<string, string> = {
  dipilih: 'Pilihan pendaftar',
  dialihkan: 'Dialihkan',
  closerec: 'Closerec',
};

const FINAL: Record<string, string> = {
  diterima: 'Diterima',
  ditolak: 'Tidak diterima',
  belum: 'Belum diputuskan',
};

const label = (
  map: Record<string, string>,
  value: string | null | undefined,
) => (value ? (map[value] ?? value) : '');

const wib = (value: Date | null | undefined) => (value ? formatWib(value) : '');

const CONTACT_HEADER = ['NIM TPB', 'Email', 'WhatsApp', 'LINE'];

const contactCells = (
  contacts: ContactMap | null,
  applicationId: string,
): SheetCell[] => {
  if (!contacts) return [];
  const c = contacts.get(applicationId);
  return [c?.nimTpb ?? '', c?.email ?? '', c?.whatsapp ?? '', c?.line ?? ''];
};

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

/** Pendaftar: identitas, gelombang, pilihan, waktu kirim, dan data diri bila boleh. */
export function applicantsSheet(
  rows: Outputs<'applicants'>['rows'],
  maxChoices: number,
  contacts: ContactMap | null,
): SheetTable {
  const table = applicantTable(rows, maxChoices);
  return {
    name: 'Pendaftar',
    header: [...table.header, ...(contacts ? CONTACT_HEADER : [])],
    rows: table.body.map((cells, i) => [
      ...cells,
      ...contactCells(contacts, rows[i]!.id),
    ]),
  };
}

/** Nilai: satu tab per lingkup; kolom per kriteria berisi rata-rata (admin) atau nilai sendiri. */
export function assessmentSheets(data: Outputs<'exportAssessment'>) {
  const valueTitle = data.isAdmin ? 'rata-rata' : 'nilai saya';
  return data.scopes.map(
    (scope): SheetTable => ({
      name: `Nilai - ${scope.label}`,
      header: [
        'Kode',
        ...(data.blind ? [] : ['Nama', 'NIM', 'Program studi', 'Angkatan']),
        'Gelombang',
        ...(scope.isDivision ? ['Pilihan ke-', 'Skor', 'Status'] : []),
        'Kriteria terisi',
        ...scope.criteria.map(
          (c) =>
            `${c.name} (${c.kind === 'skor' || !data.isAdmin ? valueTitle : 'gabungan'})`,
        ),
        ...(data.isAdmin
          ? scope.criteria.map((c) => `${c.name} (jumlah penilai)`)
          : []),
      ],
      rows: scope.rows.map((row) => [
        row.code,
        ...(data.blind ? [] : [row.name, row.nim, row.prodi, row.angkatan]),
        row.waveLabel,
        ...(scope.isDivision
          ? [
              row.rank,
              row.score,
              `${label(ASSESS_STATUS, row.status)}${row.overridden ? ' (diubah manual)' : ''}`,
            ]
          : []),
        `${row.done}/${row.total}`,
        ...scope.criteria.map((c) => row.values[c.id] ?? null),
        ...(data.isAdmin
          ? scope.criteria.map((c) => row.reviewers[c.id] ?? 0)
          : []),
      ]),
    }),
  );
}

/** Prioritas: isi templat prioritas apa adanya (urutan, nilai, jawaban terpilih). */
export function prioritySheet(data: Outputs<'priorityTemplate'>): SheetTable {
  const table = templateTable(data);
  return { name: 'Prioritas', header: table.header, rows: table.body };
}

const PLACEMENT_HEADER = [
  'Nama',
  'NIM',
  'Program studi',
  'Angkatan',
  'Gelombang',
  'Pilihan ke-',
  'Jalur',
  'Skor',
  'Status penilaian',
  'Tahap',
  'Keputusan',
  'Label',
  'Bersedia dipindahkan',
  'Diterima di divisi lain',
];

/** Penempatan: satu tab per divisi; alasan keputusan tidak ikut. */
export function placementSheets(
  divisions: Awaited<ReturnType<typeof loadPlacement>>,
): SheetTable[] {
  return divisions.map((division) => ({
    name: `Penempatan - ${division.label}`,
    header: PLACEMENT_HEADER,
    rows: division.rows.map((row) => {
      const choice = row.choices.find((c) => c.divisionId === division.id);
      return [
        row.name,
        row.nim,
        row.prodi,
        row.angkatan,
        row.waveLabel,
        choice?.rank ?? null,
        label(ORIGIN, choice?.origin),
        choice?.score === null || choice?.score === undefined
          ? null
          : Math.round(Number(choice.score) * 100) / 100,
        label(ASSESS_STATUS, choice?.status as string | null | undefined),
        label(STAGE, choice?.stage),
        choice?.decision
          ? label(DECISION, choice.decision)
          : 'Belum diputuskan',
        label(TAG, choice?.tag),
        row.willingToMove ? 'Ya' : 'Tidak',
        row.acceptedElsewhere ? 'Ya' : '',
      ];
    }),
  }));
}

type ResultRow = Outputs<'resultsList'>['rows'][number];

/** Rekap Hasil: satu baris per pendaftar, pilihan beserta keputusan, dan divisi akhir. */
export function resultsSheet(
  rows: ResultRow[],
  maxChoices: number,
  banner?: string,
): SheetTable {
  return {
    name: 'Hasil',
    banner,
    header: [
      'Gelombang',
      'Nama',
      'NIM',
      'Program studi',
      'Angkatan',
      ...Array.from({ length: maxChoices }, (_, i) => `Pilihan ${i + 1}`),
      'Status akhir',
      'Diterima di',
    ],
    rows: rows.map((row) => {
      const byRank = new Map(row.choices.map((c) => [c.rank, c]));
      return [
        row.waveLabel,
        row.name,
        row.nim,
        row.prodi,
        row.angkatan,
        ...Array.from({ length: maxChoices }, (_, i) => {
          const choice = byRank.get(i + 1);
          if (!choice) return '';
          const status =
            choice.decision === 'terima'
              ? 'Diterima'
              : choice.decision === 'tolak'
                ? 'Ditolak'
                : 'Belum diputuskan';
          return `${choice.label} · ${status}`;
        }),
        label(FINAL, row.finalStatus),
        row.acceptedLabel,
      ];
    }),
  };
}

const MEMBER_HEADER = [
  'Nama',
  'NIM',
  'Program studi',
  'Angkatan',
  'Gelombang',
  'Pilihan ke-',
  'Jalur',
  'Diterima pada',
];

function memberCells(row: ResultRow, contacts: ContactMap | null): SheetCell[] {
  const accepted = row.choices.find((c) => c.decision === 'terima');
  return [
    row.name,
    row.nim,
    row.prodi,
    row.angkatan,
    row.waveLabel,
    accepted?.rank ?? null,
    label(ORIGIN, accepted?.origin),
    wib(row.acceptedAt),
    ...contactCells(contacts, row.id),
  ];
}

/**
 * Anggota yang diterima (data terbaru saat diekspor): satu tab gabungan
 * berkolom Divisi, lalu satu tab per divisi, keduanya dengan data diri.
 */
export function acceptedSheets(
  rows: ResultRow[],
  divisions: { id: string; label: string }[],
  contacts: ContactMap | null,
  banner?: string,
): SheetTable[] {
  const header = [...MEMBER_HEADER, ...(contacts ? CONTACT_HEADER : [])];
  const accepted = rows.filter((row) => row.acceptedDivisionId !== null);
  const order = new Map(divisions.map((d, i) => [d.id, i]));
  const labels = new Map(divisions.map((d) => [d.id, d.label]));
  const sorted = [...accepted].sort(
    (a, b) =>
      (order.get(a.acceptedDivisionId!) ?? 0) -
      (order.get(b.acceptedDivisionId!) ?? 0),
  );
  return [
    {
      name: 'Diterima (semua divisi)',
      banner,
      header: ['Divisi', ...header],
      rows: sorted.map((row) => [
        labels.get(row.acceptedDivisionId!) ?? row.acceptedLabel,
        ...memberCells(row, contacts),
      ]),
    },
    ...divisions.map((division) => ({
      name: division.label,
      banner,
      header,
      rows: accepted
        .filter((row) => row.acceptedDivisionId === division.id)
        .map((row) => memberCells(row, contacts)),
    })),
  ];
}

/** Ringkasan di tab pertama: identitas oprec, waktu ekspor, dan rekap per divisi. */
export function summarySheet(input: {
  name: string;
  status: string;
  applicants: number | null;
  published: boolean | null;
  divisions:
    | {
        label: string;
        quota: number;
        accepted: number;
        extras: number;
        pending: number;
      }[]
    | null;
  included: string[];
  skipped: string[];
}): SheetTable {
  const rows: SheetCell[][] = [
    ['Oprec', input.name],
    ['Status', input.status],
    ['Diekspor pada (WIB)', formatWib(new Date())],
    ['Jumlah pendaftar', input.applicants ?? '-'],
    [
      'Hasil',
      input.published === null
        ? '-'
        : input.published
          ? 'Sudah dirilis'
          : PROVISIONAL_BANNER,
    ],
    ['Tab yang ikut', input.included.join(', ')],
    ...(input.skipped.length
      ? [['Tidak ikut (di luar hak akses)', input.skipped.join(', ')]]
      : []),
  ];
  if (input.divisions) {
    rows.push(
      [],
      [
        'Divisi',
        'Kuota',
        'Diterima',
        'Tambahan (closerec)',
        'Belum diputuskan',
      ],
      ...input.divisions.map((d) => [
        d.label,
        d.quota === 0 ? 'Tanpa batas' : d.quota,
        d.accepted,
        d.extras,
        d.pending,
      ]),
    );
  }
  return { name: 'Ringkasan', header: ['Keterangan', 'Isi'], rows };
}
