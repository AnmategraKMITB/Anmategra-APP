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
import { answerCell, answerTitle } from '~/server/export/form-responses';

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

/**
 * Jawaban formulir terpilih untuk ditempel ke tab-tab oprec. `fieldIds`
 * tidak diisi = semua pertanyaan yang boleh dilihat pemanggil.
 */
export async function loadAnswers(
  api: Caller,
  recruitmentId: string,
  fieldIds?: string[],
): Promise<Answers> {
  const data = await api.oprec.exportAnswers({ recruitmentId, fieldIds });
  return {
    columns: data.columns,
    divisions: data.divisions,
    byApp: new Map(data.rows.map((row) => [row.applicationId, row.answers])),
  };
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
// Kolom jawaban formulir
// ---------------------------------------------------------------------------

type AnswersData = Outputs<'exportAnswers'>;
export type Answers = {
  columns: AnswersData['columns'];
  divisions: AnswersData['divisions'];
  byApp: Map<string, Record<string, unknown>>;
};

/**
 * Lingkup kolom jawaban sebuah tab: `SEMUA` untuk tab berisi semua pendaftar
 * (pertanyaan divisi diberi nama divisinya), `null` untuk pertanyaan umum
 * saja, atau id divisi untuk pertanyaan umum ditambah bagian divisi itu.
 */
type AnswerScope = string | null;
const SEMUA = '*semua*';

const WRAPPED = new Set(['long_text', 'file']);

function answerPart(answers: Answers | null, scope: AnswerScope) {
  if (!answers) return { header: [], cells: () => [], wrap: [] };
  const columns = answers.columns.filter(
    (c) =>
      scope === SEMUA ||
      c.divisionIds.length === 0 ||
      (scope !== null && c.divisionIds.includes(scope)),
  );
  const divisionLabel = new Map(
    answers.divisions.map((d) => [d.id, d.label] as const),
  );
  return {
    header: columns.map((c) =>
      scope === SEMUA && c.divisionIds.length
        ? `${answerTitle(c)} [${c.divisionIds.map((d) => divisionLabel.get(d) ?? '?').join(', ')}]`
        : answerTitle(c),
    ),
    cells: (applicationId: string): SheetCell[] => {
      const row = answers.byApp.get(applicationId);
      return columns.map((c) => answerCell(c.type, row?.[c.fieldId]));
    },
    wrap: columns.flatMap((c, i) => (WRAPPED.has(c.type) ? [i] : [])),
  };
}

/** Tambahkan kolom jawaban di ujung kanan tab. */
function withAnswers(
  table: SheetTable,
  ids: string[],
  answers: Answers | null,
  scope: AnswerScope,
): SheetTable {
  const part = answerPart(answers, scope);
  if (part.header.length === 0) return table;
  const offset = table.header.length;
  return {
    ...table,
    header: [...table.header, ...part.header],
    rows: table.rows.map((cells, i) => [...cells, ...part.cells(ids[i]!)]),
    wrap: [...(table.wrap ?? []), ...part.wrap.map((i) => i + offset)],
  };
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

/** Pendaftar: identitas, gelombang, pilihan, waktu kirim, dan data diri bila boleh. */
export function applicantsSheet(
  rows: Outputs<'applicants'>['rows'],
  maxChoices: number,
  contacts: ContactMap | null,
  answers: Answers | null = null,
): SheetTable {
  const table = applicantTable(rows, maxChoices);
  return withAnswers(
    {
      name: 'Pendaftar',
      header: [...table.header, ...(contacts ? CONTACT_HEADER : [])],
      rows: table.body.map((cells, i) => [
        ...cells,
        ...contactCells(contacts, rows[i]!.id),
      ]),
    },
    rows.map((row) => row.id),
    answers,
    SEMUA,
  );
}

/**
 * Jawaban formulir oprec: tab "Jawaban - Umum" untuk pertanyaan umum semua
 * pendaftar, lalu satu tab per divisi berisi pertanyaan bagian divisi itu
 * saja, hanya untuk yang memilih divisi tersebut.
 */
export function answersSheets(
  rows: Outputs<'applicants'>['rows'],
  answers: Answers,
): SheetTable[] {
  const visible = rows.filter((row) => answers.byApp.has(row.id));
  const identity = (row: (typeof rows)[number]): SheetCell[] => [
    row.name,
    row.nim,
    row.prodi,
    row.angkatan,
    row.waveLabel,
  ];
  const header = ['Nama', 'NIM', 'Program studi', 'Angkatan', 'Gelombang'];
  const tables: SheetTable[] = [];
  if (answers.columns.some((c) => c.divisionIds.length === 0)) {
    tables.push(
      withAnswers(
        { name: 'Jawaban - Umum', header, rows: visible.map(identity) },
        visible.map((row) => row.id),
        answers,
        null,
      ),
    );
  }
  for (const division of answers.divisions) {
    const own = answers.columns.filter((c) =>
      c.divisionIds.includes(division.id),
    );
    if (own.length === 0) continue;
    const members = visible.filter((row) =>
      row.choices.some((c) => c.divisionId === division.id),
    );
    tables.push(
      withAnswers(
        {
          name: `Jawaban - ${division.label}`,
          header: [...header, 'Pilihan ke-'],
          rows: members.map((row) => [
            ...identity(row),
            row.choices.find((c) => c.divisionId === division.id)?.rank ?? null,
          ]),
        },
        members.map((row) => row.id),
        { ...answers, columns: own },
        division.id,
      ),
    );
  }
  return tables;
}

/** Nilai: satu tab per lingkup; kolom per kriteria berisi rata-rata (admin) atau nilai sendiri. */
export function assessmentSheets(
  data: Outputs<'exportAssessment'>,
  answers: Answers | null = null,
) {
  const valueTitle = data.isAdmin ? 'rata-rata' : 'nilai saya';
  return data.scopes.map((scope) =>
    withAnswers(
      {
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
      },
      scope.rows.map((row) => row.applicationId),
      answers,
      scope.divisionId,
    ),
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
  answers: Answers | null = null,
): SheetTable[] {
  return divisions.map((division) =>
    withAnswers(
      {
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
      },
      division.rows.map((row) => row.id),
      answers,
      division.id,
    ),
  );
}

type ResultRow = Outputs<'resultsList'>['rows'][number];

/** Rekap Hasil: satu baris per pendaftar, pilihan beserta keputusan, dan divisi akhir. */
export function resultsSheet(
  rows: ResultRow[],
  maxChoices: number,
  banner?: string,
  answers: Answers | null = null,
): SheetTable {
  return withAnswers(
    {
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
    },
    rows.map((row) => row.id),
    answers,
    SEMUA,
  );
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
  answers: Answers | null = null,
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
    withAnswers(
      {
        name: 'Diterima (semua divisi)',
        banner,
        header: ['Divisi', ...header],
        rows: sorted.map((row) => [
          labels.get(row.acceptedDivisionId!) ?? row.acceptedLabel,
          ...memberCells(row, contacts),
        ]),
      },
      sorted.map((row) => row.id),
      answers,
      null,
    ),
    ...divisions.map((division) => {
      const members = accepted.filter(
        (row) => row.acceptedDivisionId === division.id,
      );
      return withAnswers(
        {
          name: division.label,
          banner,
          header,
          rows: members.map((row) => memberCells(row, contacts)),
        },
        members.map((row) => row.id),
        answers,
        division.id,
      );
    }),
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
