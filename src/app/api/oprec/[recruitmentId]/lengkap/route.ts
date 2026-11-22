import { type NextRequest } from 'next/server';
import { type SheetTable } from '~/lib/spreadsheet/workbook';
import { createCaller } from '~/server/api/root';
import {
  PROVISIONAL_BANNER,
  slugOf,
} from '~/server/api/routers/oprec/applicants-export';
import { createTRPCContext } from '~/server/api/trpc';
import {
  collectResponses,
  responsesSheet,
} from '~/server/export/form-responses';
import {
  acceptedSheets,
  applicantsSheet,
  assessmentSheets,
  loadApplicants,
  loadContacts,
  loadPlacement,
  loadResults,
  placementSheets,
  prioritySheet,
  resultsSheet,
  summarySheet,
} from '~/server/export/oprec';
import {
  exportErrorResponse,
  spreadsheetResponse,
  unlessForbidden,
} from '~/server/spreadsheet-response';

const STATUS_LABEL = { draft: 'Draf', open: 'Dibuka', closed: 'Ditutup' };

/**
 * Ekspor lengkap satu oprec dalam satu workbook XLSX, satu tab per tahap atau
 * jenis data: Ringkasan, Pendaftar, Jawaban formulir, Nilai per lingkup,
 * Prioritas, Penempatan per divisi, Hasil, lalu anggota yang diterima (gabungan
 * dan per divisi) dengan data diri. Tiap bagian memakai hak akses halamannya;
 * yang tidak boleh dibuka pengekspor dilewati dan dicatat di Ringkasan.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recruitmentId: string }> },
) {
  const { recruitmentId } = await params;
  const api = createCaller(await createTRPCContext({ headers: req.headers }));

  try {
    // Hanya pengelola oprec yang bisa membuka detail; ini juga gerbang aksesnya.
    const detail = await api.oprec.get({ recruitmentId });
    const formId = detail.formId;

    const [
      applicants,
      contacts,
      responses,
      assessment,
      priority,
      placement,
      overview,
      results,
    ] = await Promise.all([
      loadApplicants(api, recruitmentId),
      unlessForbidden(() => loadContacts(api, recruitmentId)),
      formId
        ? unlessForbidden(() => collectResponses(api, formId))
        : Promise.resolve(null),
      unlessForbidden(() => api.oprec.exportAssessment({ recruitmentId })),
      unlessForbidden(() => api.oprec.priorityTemplate({ recruitmentId })),
      unlessForbidden(() => loadPlacement(api, recruitmentId)),
      unlessForbidden(() => api.oprec.resultsOverview({ recruitmentId })),
      unlessForbidden(() => loadResults(api, recruitmentId)),
    ]);

    const banner =
      overview && !overview.published ? PROVISIONAL_BANNER : undefined;
    const parts: [string, SheetTable[] | null][] = [
      ['Pendaftar', [applicantsSheet(applicants, detail.maxChoices, contacts)]],
      [
        'Jawaban formulir',
        responses ? [responsesSheet('Jawaban formulir', responses)] : null,
      ],
      ['Nilai', assessment ? assessmentSheets(assessment) : null],
      ['Prioritas', priority ? [prioritySheet(priority)] : null],
      ['Penempatan', placement?.length ? placementSheets(placement) : null],
      [
        'Hasil',
        overview && results
          ? [resultsSheet(results, overview.maxChoices, banner)]
          : null,
      ],
      [
        'Diterima per divisi',
        overview && results
          ? acceptedSheets(results, overview.divisions, contacts, banner)
          : null,
      ],
    ];
    const included = parts.filter(([, s]) => s).map(([name]) => name);
    const skipped = parts.filter(([, s]) => !s).map(([name]) => name);
    if (!contacts) skipped.push('Data diri (email, WhatsApp, LINE)');

    const sheets = [
      summarySheet({
        name: detail.name,
        status: STATUS_LABEL[detail.status],
        applicants: applicants.length,
        published: overview ? overview.published : null,
        divisions: overview?.divisions ?? null,
        included,
        skipped,
      }),
      ...parts.flatMap(([, s]) => s ?? []),
    ];

    if (overview)
      await api.oprec.resultsLogExport({ recruitmentId, format: 'xlsx' });

    return await spreadsheetResponse(
      { title: `Oprec ${detail.name} - lengkap`, sheets },
      `${slugOf(detail.name)}-lengkap${banner ? '-sementara' : ''}`,
      'xlsx',
    );
  } catch (err) {
    return exportErrorResponse(err);
  }
}
