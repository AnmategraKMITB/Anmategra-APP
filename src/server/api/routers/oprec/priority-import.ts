/**
 * Templat dan impor daftar prioritas lewat spreadsheet, untuk panitia yang
 * menyeleksi ratusan pendaftar di Excel atau Google Sheets.
 *
 * Alur: unduh templat (satu baris per pendaftar per divisi) → isi kolom
 * Urutan dan Keterangan → unggah → pratinjau (tidak menulis apa pun) →
 * terapkan. Penerapan menulis ulang daftar divisi yang berubah dengan aturan
 * yang sama dengan menyimpan dari papan: hak menyusun, metode prioritas,
 * penempatan berjalan, daftar belum dikunci, dan versi yang sama dengan saat
 * pratinjau.
 */
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { richTextToPlain } from '~/app/_components/forms/rich-text';
import { candidacy, ownChoices } from '~/lib/oprec/priority';
import {
  type DivisionPlan,
  type ImportDivision,
  normalizeName,
  planPriorityImport,
} from '~/lib/oprec/priority-import';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  application,
  divisionPriority,
  formAnswer,
  mahasiswa,
  recruitmentDivision,
  recruitmentSectionBinding,
} from '~/server/db/schema';

import { formatCsvAnswer } from '../form/csv';
import { loadResponseFields } from '../form/responses';
import { type Queryable as FormDb, type Tx } from '../form/services';
import { type AssessAccess, canRankDivision } from './assess-access';
import { logAction } from './log';
import {
  type PoolApp,
  assertEditable,
  chunks,
  identity,
  loadPool,
  lockDivision,
} from './priority';
import {
  type TemplateData,
  type TemplateRow,
  readSheet,
} from './priority-sheet';
import { type Queryable, conflict, notFound } from './services';

const id = z.string().min(1).max(255);
/** Batas ukuran file unggahan (setelah base64 diurai). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FileInput = z.object({
  recruitmentId: id,
  fileName: z.string().max(255),
  /** Isi file dalam base64. */
  content: z
    .string()
    .min(1)
    .max(Math.ceil(MAX_FILE_BYTES / 3) * 4 + 8),
});

type Pool = Awaited<ReturnType<typeof loadPool>>;
type Recruitment = Parameters<typeof assertEditable>[0] & {
  id: string;
  name: string;
  blind: boolean;
  allowRedirect: boolean;
};

const badRequest = (message: string): never => {
  throw new TRPCError({ code: 'BAD_REQUEST', message });
};

function decode(content: string): Buffer {
  const buffer = Buffer.from(content, 'base64');
  if (buffer.length === 0) badRequest('File kosong.');
  if (buffer.length > MAX_FILE_BYTES) {
    badRequest('File terlalu besar (batas 5 MB).');
  }
  return buffer;
}

/**
 * Nama divisi di templat: nama unit bila unik di oprec ini, selain itu
 * "Induk / Unit". Bentuk "Induk / Unit" selalu diterima saat impor.
 */
export function divisionNames(
  divisions: readonly {
    id: string;
    label: string;
    groupLabel: string | null;
    sortOrder: number;
  }[],
): Map<string, { name: string; aliases: string[] }> {
  const countOf = (names: string[]) => {
    const m = new Map<string, number>();
    for (const n of names) {
      const k = normalizeName(n);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const full = (d: (typeof divisions)[number]) =>
    d.groupLabel ? `${d.groupLabel} / ${d.label}` : d.label;
  const labels = countOf(divisions.map((d) => d.label));
  const fulls = countOf(divisions.map(full));
  return new Map(
    divisions.map((d) => {
      const f = full(d);
      if (labels.get(normalizeName(d.label)) === 1) {
        return [d.id, { name: d.label, aliases: f === d.label ? [] : [f] }];
      }
      if (fulls.get(normalizeName(f)) === 1) {
        return [d.id, { name: f, aliases: [] }];
      }
      return [d.id, { name: `${f} (${d.sortOrder + 1})`, aliases: [] }];
    }),
  );
}

/** NIM TPB per pengguna; hanya untuk mencocokkan impor, tidak ditampilkan. */
async function loadTpbNims(
  db: Queryable,
  pool: Pool,
): Promise<Map<string, number>> {
  const userIds = [...new Set(pool.apps.map((a) => a.userId))];
  const out = new Map<string, number>();
  for (const part of chunks(userIds)) {
    const rows = await db
      .select({ userId: mahasiswa.userId, nimTpb: mahasiswa.nimTpb })
      .from(mahasiswa)
      .where(inArray(mahasiswa.userId, part));
    for (const row of rows) {
      if (row.nimTpb !== null) out.set(row.userId, row.nimTpb);
    }
  }
  return out;
}

function nimsOf(app: PoolApp, tpb: ReadonlyMap<string, number>): number[] {
  return [app.nim, tpb.get(app.userId) ?? null].filter(
    (n): n is number => n !== null,
  );
}

/** Rencana impor dari tabel sel terhadap data oprec saat ini. */
function planFor(
  pool: Pool,
  tpb: ReadonlyMap<string, number>,
  rec: Recruitment,
  access: AssessAccess,
  table: string[][],
) {
  const names = divisionNames(pool.divisions);
  const divisions: ImportDivision[] = pool.divisions.map((d) => ({
    id: d.id,
    name: names.get(d.id)!.name,
    aliases: names.get(d.id)!.aliases,
    canRank: canRankDivision(access, d.id),
    locked: d.lockedAt !== null,
    candidates: pool.apps.flatMap((app) => {
      const c = candidacy(app, d.id, rec.allowRedirect);
      return c
        ? [
            {
              applicationId: app.id,
              nims: nimsOf(app, tpb),
              blocked: c.blocked,
            },
          ]
        : [];
    }),
  }));
  return planPriorityImport({
    table,
    divisions,
    allowNim: !(rec.blind && !access.isAdmin),
  });
}

/** Apa yang berubah dibanding daftar tersimpan. */
function diffOf(pool: Pool, plan: DivisionPlan) {
  const saved = pool.priorities.filter((p) => p.divisionId === plan.divisionId);
  const current = saved
    .filter((p) => p.rank !== null)
    .sort((x, y) => x.rank! - y.rank!)
    .map((p) => p.applicationId);
  const orderChanged =
    current.length !== plan.order.length ||
    current.some((applicationId, i) => applicationId !== plan.order[i]);
  const noteOf = new Map(saved.map((p) => [p.applicationId, p.note]));
  const noteChanges = plan.notes
    ? [...plan.notes].filter(
        ([applicationId, note]) => (noteOf.get(applicationId) ?? null) !== note,
      )
    : [];
  return { orderChanged, noteChanges };
}

/**
 * Tulis ulang seluruh urutan satu divisi (indeks 0 = urutan 1), dengan cara
 * yang sama seperti `prioritySave`. Keterangan tidak disentuh. Pemanggil
 * memegang kunci divisi dan menaikkan versinya.
 */
async function writeDivisionOrder(
  tx: Tx,
  divisionId: string,
  order: readonly string[],
  actorId: string,
) {
  // Kosongkan urutan lama tanpa melanggar CHECK (urutan atau keterangan
  // harus ada): baris tanpa keterangan dihapus, sisanya dibuat tanpa
  // urutan. Lalu urutan baru ditulis ulang.
  await tx
    .delete(divisionPriority)
    .where(
      and(
        eq(divisionPriority.divisionId, divisionId),
        isNull(divisionPriority.note),
      ),
    );
  await tx
    .update(divisionPriority)
    .set({ rank: null })
    .where(eq(divisionPriority.divisionId, divisionId));
  const rows = order.map((applicationId, index) => ({
    divisionId,
    applicationId,
    rank: index + 1,
    updatedBy: actorId,
  }));
  for (const part of chunks(rows)) {
    await tx
      .insert(divisionPriority)
      .values(part)
      .onConflictDoUpdate({
        target: [divisionPriority.divisionId, divisionPriority.applicationId],
        set: {
          rank: sql`excluded.rank`,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      });
  }
}

/** Tulis keterangan yang berubah; null = hapus. */
async function writeNotes(
  tx: Tx,
  divisionId: string,
  changes: readonly (readonly [string, string | null])[],
  actorId: string,
) {
  const set = changes.flatMap(([applicationId, note]) =>
    note === null
      ? []
      : [{ divisionId, applicationId, note, updatedBy: actorId }],
  );
  for (const part of chunks(set)) {
    await tx
      .insert(divisionPriority)
      .values(part)
      .onConflictDoUpdate({
        target: [divisionPriority.divisionId, divisionPriority.applicationId],
        set: {
          note: sql`excluded.note`,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      });
  }
  const clear = changes.flatMap(([applicationId, note]) =>
    note === null ? [applicationId] : [],
  );
  for (const part of chunks(clear)) {
    const where = and(
      eq(divisionPriority.divisionId, divisionId),
      inArray(divisionPriority.applicationId, part),
    );
    // Baris tanpa urutan hanya berisi keterangan: hapus. Sisanya kosongkan.
    await tx
      .delete(divisionPriority)
      .where(and(where, isNull(divisionPriority.rank)));
    await tx
      .update(divisionPriority)
      .set({ note: null, updatedBy: actorId, updatedAt: new Date() })
      .where(where);
  }
}

/**
 * Pertanyaan formulir dan jawaban semua pendaftar untuk kolom templat, dimuat
 * sekaligus (bukan per pendaftar). Pertanyaan umum selalu ikut. Pertanyaan di
 * bagian yang terikat divisi hanya ikut bila pemanggil menyusun salah satu
 * divisi itu, dan sel-nya dikosongkan pada baris divisi lain, sama dengan
 * panel jawaban di papan prioritas.
 */
async function loadTemplateAnswers(
  db: FormDb,
  rec: { id: string; formId: string },
  divisionIds: ReadonlySet<string>,
  /** Hanya jawaban pendaftar ini yang dimuat. */
  applicationIds: ReadonlySet<string>,
) {
  const [bindings, fields, apps] = await Promise.all([
    db
      .select({
        sectionId: recruitmentSectionBinding.formSectionId,
        divisionId: recruitmentSectionBinding.divisionId,
      })
      .from(recruitmentSectionBinding)
      .where(eq(recruitmentSectionBinding.recruitmentId, rec.id)),
    loadResponseFields(db, rec.formId),
    db
      .select({
        id: application.id,
        submissionId: application.formSubmissionId,
      })
      .from(application)
      .where(eq(application.recruitmentId, rec.id)),
  ]);

  const boundTo = new Map<string, Set<string>>();
  for (const b of bindings) {
    const set = boundTo.get(b.sectionId) ?? new Set<string>();
    set.add(b.divisionId);
    boundTo.set(b.sectionId, set);
  }
  const columns = fields.flatMap((f) => {
    if (f.type === 'unit_choice') return [];
    const only = f.sectionId ? (boundTo.get(f.sectionId) ?? null) : null;
    if (only && ![...only].some((d) => divisionIds.has(d))) return [];
    const label = richTextToPlain(f.label);
    return [
      {
        fieldId: f.id,
        type: f.type,
        label: f.archivedAt ? `${label} (diarsipkan)` : label,
        only,
      },
    ];
  });

  const submissionOf = new Map<string, string>();
  for (const a of apps) {
    if (a.submissionId && applicationIds.has(a.id)) {
      submissionOf.set(a.id, a.submissionId);
    }
  }
  const wanted = new Set(columns.map((c) => c.fieldId));
  const valuesOf = new Map<string, Map<string, unknown>>();
  if (wanted.size > 0) {
    for (const part of chunks([...new Set(submissionOf.values())])) {
      const rows = await db
        .select({
          submissionId: formAnswer.submissionId,
          fieldId: formAnswer.fieldId,
          value: formAnswer.value,
        })
        .from(formAnswer)
        .where(inArray(formAnswer.submissionId, part));
      for (const row of rows) {
        if (!row.fieldId || !wanted.has(row.fieldId)) continue;
        const values =
          valuesOf.get(row.submissionId) ?? new Map<string, unknown>();
        values.set(row.fieldId, row.value);
        valuesOf.set(row.submissionId, values);
      }
    }
  }

  return {
    labels: columns.map((c) => c.label),
    answersFor(applicationId: string, divisionId: string): string[] {
      const submissionId = submissionOf.get(applicationId);
      const values = submissionId ? valuesOf.get(submissionId) : undefined;
      return columns.map((c) =>
        c.only && !c.only.has(divisionId)
          ? ''
          : formatCsvAnswer(c.type, values?.get(c.fieldId)),
      );
    },
  };
}

export const priorityImportProcedures = {
  /**
   * Isi templat: satu baris per pendaftar per divisi yang boleh disusun
   * pemanggil, beserta urutan dan keterangan tersimpan. Pada mode blind,
   * identitas hanya untuk admin.
   *
   * Dengan `divisionId`, templat hanya berisi divisi itu dan memuat jawaban
   * formulir. Tanpa `divisionId`, semua divisi ikut tetapi tanpa jawaban:
   * pendaftar yang bersedia dipindahkan menjadi kandidat di setiap divisi,
   * jadi jawaban mereka akan terulang di puluhan baris dan file menjadi
   * terlalu besar untuk dibuat server.
   */
  priorityTemplate: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, divisionId: id.optional() }))
    .query(async ({ ctx, input }): Promise<TemplateData> => {
      const rec = ctx.recruitment;
      const a = ctx.assess;
      const pool = await loadPool(ctx.db, rec.id);
      const hide = rec.blind && !a.isAdmin;
      const names = divisionNames(pool.divisions);
      const nameOf = (divisionId: string) => names.get(divisionId)?.name ?? '';
      const saved = new Map(
        pool.priorities.map((p) => [`${p.divisionId}:${p.applicationId}`, p]),
      );
      const only = input.divisionId;
      if (only !== undefined) {
        if (!pool.divisions.some((d) => d.id === only)) {
          notFound('Divisi itu bukan milik oprec ini.');
        }
        if (!canRankDivision(a, only)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Kamu tidak menyusun daftar prioritas divisi itu.',
          });
        }
      }
      const targets = pool.divisions.filter(
        (d) =>
          canRankDivision(a, d.id) && (only === undefined || d.id === only),
      );
      const answers =
        only === undefined
          ? null
          : await loadTemplateAnswers(
              ctx.db,
              rec,
              new Set([only]),
              new Set(
                pool.apps
                  .filter((app) => candidacy(app, only, rec.allowRedirect))
                  .map((app) => app.id),
              ),
            );

      const divisions: TemplateData['divisions'] = [];
      const rows: TemplateRow[] = [];
      for (const d of targets) {
        let rankable = 0;
        const part: TemplateRow[] = [];
        for (const app of pool.apps) {
          const c = candidacy(app, d.id, rec.allowRedirect);
          if (!c) continue;
          if (!c.blocked) rankable += 1;
          const p = saved.get(`${d.id}:${app.id}`);
          const who = identity(hide, app);
          const here = app.choices.find(
            (x) => x.origin === 'dipilih' && x.divisionId === d.id,
          );
          part.push({
            division: nameOf(d.id),
            code: who.code,
            name: who.name,
            nim: who.nim,
            prodi: who.prodi,
            angkatan: who.angkatan,
            choiceRank: c.kind === 'pilihan' ? c.choiceRank : null,
            choices: ownChoices(app)
              .map((x) => `${x.rank}. ${nameOf(x.divisionId)}`)
              .join('; '),
            willingToMove: app.willingToMove,
            blocked: c.blocked,
            score: here?.score ?? null,
            rank: c.blocked ? null : (p?.rank ?? null),
            note: p?.note ?? null,
            applicationId: app.id,
            answers: answers ? answers.answersFor(app.id, d.id) : [],
          });
        }
        const group = (r: TemplateRow) =>
          r.blocked ? 2 : r.rank !== null ? 0 : 1;
        part.sort(
          (x, y) =>
            group(x) - group(y) ||
            (x.rank ?? 0) - (y.rank ?? 0) ||
            (x.choiceRank ?? 99) - (y.choiceRank ?? 99) ||
            (x.name ?? x.code).localeCompare(y.name ?? y.code),
        );
        rows.push(...part);
        divisions.push({
          name: nameOf(d.id),
          quota: d.quota,
          candidates: part.length,
          rankable,
        });
      }
      return {
        recruitmentName: rec.name,
        blind: hide,
        answerColumns: answers?.labels ?? [],
        divisions,
        rows,
      };
    }),

  /** Baca file isian dan tampilkan apa yang akan berubah. Tidak menulis. */
  priorityImportPreview: oprecAssessProcedure
    .input(FileInput)
    .mutation(async ({ ctx, input }) => {
      assertEditable(ctx.recruitment);
      const table = await readSheet(input.fileName, decode(input.content));
      const pool = await loadPool(ctx.db, ctx.recruitment.id);
      const tpb = await loadTpbNims(ctx.db, pool);
      const plan = planFor(pool, tpb, ctx.recruitment, ctx.assess, table);
      const versionOf = new Map(
        pool.divisions.map((d) => [d.id, d.priorityVersion]),
      );
      return {
        rowCount: plan.rowCount,
        errorCount: plan.errorCount,
        warningCount: plan.warningCount,
        errors: plan.errors,
        warnings: plan.warnings,
        divisions: plan.divisions.map((d) => {
          const diff = diffOf(pool, d);
          return {
            divisionId: d.divisionId,
            name: d.name,
            ranked: d.order.length,
            missing: d.missing,
            skippedBlocked: d.skippedBlocked,
            orderChanged: diff.orderChanged,
            notesChanged: diff.noteChanges.length,
            version: versionOf.get(d.divisionId) ?? 0,
          };
        }),
      };
    }),

  /**
   * Terapkan file isian. `versions` berisi versi tiap divisi yang berubah saat
   * pratinjau; bila daftar berubah sejak itu, penerapan ditolak.
   */
  priorityImportApply: oprecAssessProcedure
    .input(
      FileInput.extend({ versions: z.record(id, z.number().int().min(0)) }),
    )
    .mutation(async ({ ctx, input }) => {
      const divisionIds = Object.keys(input.versions).sort();
      if (divisionIds.length === 0) {
        badRequest('Tidak ada perubahan untuk diterapkan.');
      }
      for (const divisionId of divisionIds) {
        if (!canRankDivision(ctx.assess, divisionId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              'Kamu tidak menyusun daftar prioritas salah satu divisi di file ini.',
          });
        }
      }
      const table = await readSheet(input.fileName, decode(input.content));
      const actorId = ctx.session.user.id;

      return ctx.db.transaction(async (tx) => {
        // Kunci divisi berurutan menurut id supaya dua impor tidak saling tunggu.
        let rec: Recruitment | null = null;
        for (const divisionId of divisionIds) {
          const locked = await lockDivision(
            tx,
            input.recruitmentId,
            divisionId,
          );
          rec = locked.rec;
          if (locked.division.lockedAt) {
            conflict(
              'Salah satu daftar di file ini sudah dikunci. Buka kuncinya dulu, lalu ulangi pratinjau.',
            );
          }
          if (locked.division.version !== input.versions[divisionId]) {
            conflict(
              'Daftar prioritas berubah sejak pratinjau. Ulangi pratinjau.',
            );
          }
        }
        if (!rec) return badRequest('Tidak ada perubahan untuk diterapkan.');
        assertEditable(rec);

        const pool = await loadPool(tx, rec.id);
        const tpb = await loadTpbNims(tx, pool);
        const plan = planFor(pool, tpb, rec, ctx.assess, table);
        if (plan.errorCount > 0) {
          badRequest(
            `File ini masih punya ${plan.errorCount} masalah. Ulangi pratinjau.`,
          );
        }

        const summary: {
          divisionId: string;
          name: string;
          ranked: number;
          notesChanged: number;
        }[] = [];
        for (const d of plan.divisions) {
          const diff = diffOf(pool, d);
          if (!diff.orderChanged && diff.noteChanges.length === 0) continue;
          const base = input.versions[d.divisionId];
          if (base === undefined) {
            conflict(
              'Daftar prioritas berubah sejak pratinjau. Ulangi pratinjau.',
            );
          }
          if (diff.orderChanged) {
            await writeDivisionOrder(tx, d.divisionId, d.order, actorId);
          }
          if (diff.noteChanges.length > 0) {
            await writeNotes(tx, d.divisionId, diff.noteChanges, actorId);
          }
          await tx
            .update(recruitmentDivision)
            .set({ priorityVersion: base + 1 })
            .where(eq(recruitmentDivision.id, d.divisionId));
          summary.push({
            divisionId: d.divisionId,
            name: d.name,
            ranked: d.order.length,
            notesChanged: diff.noteChanges.length,
          });
        }

        if (summary.length > 0) {
          await logAction(tx, {
            recruitmentId: rec.id,
            actorId,
            action: 'prioritas_diimpor',
            entityType: 'recruitment',
            entityId: rec.id,
            detail: { file: input.fileName, divisions: summary },
          });
        }
        return { updated: summary.length, divisions: summary };
      });
    }),
};
