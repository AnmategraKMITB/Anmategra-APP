import { and, asc, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  choiceStatusOverride,
  divisionPriority,
  recruitment,
  recruitmentDivision,
  recruitmentLog,
} from '~/server/db/schema';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import {
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { oprecRouter } from '.';
import { readSheet, templateTable, templateWorkbook } from './priority-sheet';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const appRouter = createTRPCRouter({ oprec: oprecRouter });

type Actor = { id: string; role: string; lembagaId: string | null };
type Caller = ReturnType<typeof callerFor>;

function callerFor(actor: Actor) {
  return createCallerFactory(appRouter)({
    db,
    session: { user: { ...actor }, expires: '' },
    headers: new Headers(),
  } as never);
}

const student = async (): Promise<Actor> => ({
  id: (await createUser(db)).id,
  role: 'mahasiswa',
  lembagaId: null,
});

/** Oprec dengan divisi Logistik, IT, Acara; tiap divisi punya Kadiv. */
async function setup() {
  const w = await baseWorld(db, ['Logistik', 'IT', 'Acara']);
  const heads: Actor[] = [];
  for (const u of w.units) {
    const head = await student();
    await placeAt(db, u.headPositionId, head.id);
    heads.push(head);
  }
  const admin = callerFor(w.owner);
  const { recruitmentId } = await admin.oprec.createFromSetup({
    eventId: w.eventId,
    name: 'Tour AMI Uji',
    form: { mode: 'template' as const },
    divisions: w.units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 3,
    allowRedirect: false,
  });
  const divisions = await db
    .select({ id: recruitmentDivision.id })
    .from(recruitmentDivision)
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder));
  const [logistik, it_, acara] = divisions as [
    (typeof divisions)[number],
    (typeof divisions)[number],
    (typeof divisions)[number],
  ];
  return { w, admin, heads, recruitmentId, logistik, it: it_, acara };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** Pendaftar (dengan NIM) lewat form, pilihan berurutan. */
async function apply(recruitmentId: string, divisionIds: string[]) {
  const user = await createUser(db);
  const mhs = await createMahasiswa(db, user.id, {
    nama: `Pendaftar ${user.id.slice(0, 4)}`,
  });
  const [app] = await db
    .insert(application)
    .values({
      recruitmentId,
      userId: user.id,
      source: 'form',
      submittedAt: new Date(),
    })
    .returning();
  const choices = await db
    .insert(applicationChoice)
    .values(
      divisionIds.map((divisionId, i) => ({
        applicationId: app!.id,
        divisionId,
        rank: i + 1,
        origin: 'dipilih' as const,
      })),
    )
    .returning();
  return { id: app!.id, nim: mhs.nim, choices };
}

async function usePriority(s: Setup) {
  await s.admin.oprec.prioritySetMethod({
    recruitmentId: s.recruitmentId,
    method: 'prioritas',
  });
}

const b64 = (content: string | ArrayBuffer) =>
  (typeof content === 'string'
    ? Buffer.from(content, 'utf8')
    : Buffer.from(content)
  ).toString('base64');

function csv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

async function preview(
  caller: Caller,
  s: Setup,
  content: string | ArrayBuffer,
  fileName = 'isian.csv',
) {
  return caller.oprec.priorityImportPreview({
    recruitmentId: s.recruitmentId,
    fileName,
    content: b64(content),
  });
}

/** Pratinjau lalu terapkan dengan versi dari pratinjau. */
async function importFile(
  caller: Caller,
  s: Setup,
  content: string | ArrayBuffer,
  fileName = 'isian.csv',
) {
  const p = await preview(caller, s, content, fileName);
  expect(p.errors).toEqual([]);
  return caller.oprec.priorityImportApply({
    recruitmentId: s.recruitmentId,
    fileName,
    content: b64(content),
    versions: Object.fromEntries(
      p.divisions
        .filter((d) => d.orderChanged || d.notesChanged > 0)
        .map((d) => [d.divisionId, d.version]),
    ),
  });
}

async function board(caller: Caller, s: Setup, divisionId: string) {
  return caller.oprec.priorityBoard({
    recruitmentId: s.recruitmentId,
    divisionId,
  });
}

const ranksOf = async (caller: Caller, s: Setup, divisionId: string) =>
  Object.fromEntries(
    (await board(caller, s, divisionId)).rows.map((r) => [
      r.applicationId,
      { rank: r.rank, note: r.note },
    ]),
  );

describe('templat prioritas', () => {
  it('satu baris per pendaftar per divisi, berisi urutan dan keterangan tersimpan', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    await s.admin.oprec.prioritySave({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      order: [y.id],
      baseVersion: 0,
    });
    await s.admin.oprec.priorityNote({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      applicationId: x.id,
      note: '- teliti',
    });

    const data = await s.admin.oprec.priorityTemplate({
      recruitmentId: s.recruitmentId,
    });
    expect(data.divisions.map((d) => [d.name, d.candidates])).toEqual([
      ['Logistik', 2],
      ['IT', 1],
      ['Acara', 0],
    ]);
    expect(
      data.rows.map((r) => [
        r.division,
        r.applicationId,
        r.choiceRank,
        r.rank,
        r.note,
      ]),
    ).toEqual([
      ['Logistik', y.id, 1, 1, null],
      ['Logistik', x.id, 1, null, '- teliti'],
      ['IT', x.id, 2, null, null],
    ]);
    expect(data.rows[1]).toMatchObject({
      nim: x.nim,
      choices: '1. Logistik; 2. IT',
    });

    // Kadiv IT hanya mendapat divisinya.
    const itHead = callerFor(s.heads[1]!);
    const own = await itHead.oprec.priorityTemplate({
      recruitmentId: s.recruitmentId,
    });
    expect(own.rows.map((r) => r.division)).toEqual(['IT']);

    // Mode blind: identitas hanya untuk admin, dan kolomnya tidak ikut.
    await db
      .update(recruitment)
      .set({ blind: true })
      .where(eq(recruitment.id, s.recruitmentId));
    const hidden = await itHead.oprec.priorityTemplate({
      recruitmentId: s.recruitmentId,
    });
    expect(hidden.blind).toBe(true);
    expect(hidden.rows[0]).toMatchObject({ name: null, nim: null });
    expect(templateTable(hidden).header).not.toContain('NIM');
    const adminView = await s.admin.oprec.priorityTemplate({
      recruitmentId: s.recruitmentId,
    });
    expect(adminView.rows[0]!.nim).not.toBeNull();
  });
});

describe('impor urutan prioritas', () => {
  it('CSV lewat ID dan NIM: urutan, keterangan, versi, dan log; divisi lain tidak tersentuh', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    const z = await apply(s.recruitmentId, [s.logistik.id, s.acara.id]);
    await s.admin.oprec.prioritySave({
      recruitmentId: s.recruitmentId,
      divisionId: s.acara.id,
      order: [z.id],
      baseVersion: 0,
    });

    const file = csv([
      ['Divisi', 'NIM', 'Urutan', 'Keterangan', 'ID'],
      ['Logistik', z.nim, 1, 'pengalaman logistik', ''],
      ['Logistik', '', 4, '', x.id],
      ['Logistik', y.nim, '', '', ''],
      ['IT', '', 1, '', x.id],
    ]);
    const p = await preview(s.admin, s, file);
    expect(p).toMatchObject({ rowCount: 4, errorCount: 0, warningCount: 0 });
    expect(
      p.divisions.map((d) => [
        d.name,
        d.ranked,
        d.orderChanged,
        d.notesChanged,
      ]),
    ).toEqual([
      ['Logistik', 2, true, 1],
      ['IT', 1, true, 0],
    ]);

    const result = await importFile(s.admin, s, file);
    expect(result.updated).toBe(2);
    expect(await ranksOf(s.admin, s, s.logistik.id)).toEqual({
      [z.id]: { rank: 1, note: 'pengalaman logistik' },
      [x.id]: { rank: 2, note: null },
      [y.id]: { rank: null, note: null },
    });
    expect((await board(s.admin, s, s.it.id)).version).toBe(1);
    expect((await board(s.admin, s, s.logistik.id)).version).toBe(1);
    // Acara tidak ada di file: urutan dan versinya tetap.
    const acara = await board(s.admin, s, s.acara.id);
    expect(acara.version).toBe(1);
    expect(acara.rows[0]).toMatchObject({ applicationId: z.id, rank: 1 });

    const logs = await db
      .select({ action: recruitmentLog.action })
      .from(recruitmentLog)
      .where(
        and(
          eq(recruitmentLog.recruitmentId, s.recruitmentId),
          eq(recruitmentLog.action, 'prioritas_diimpor'),
        ),
      );
    expect(logs).toHaveLength(1);

    // File yang sama lagi: tidak ada perubahan.
    const again = await preview(s.admin, s, file);
    expect(
      again.divisions.every((d) => !d.orderChanged && d.notesChanged === 0),
    ).toBe(true);
    await expect(
      s.admin.oprec.priorityImportApply({
        recruitmentId: s.recruitmentId,
        fileName: 'isian.csv',
        content: b64(file),
        versions: {},
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('templat xlsx bolak-balik: unduh, isi kolom Urutan, unggah', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
    await s.admin.oprec.priorityNote({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      applicationId: x.id,
      note: '=bukan rumus',
    });

    const data = await s.admin.oprec.priorityTemplate({
      recruitmentId: s.recruitmentId,
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await templateWorkbook(data));
    expect(workbook.worksheets.map((w) => w.name)).toEqual([
      'Prioritas',
      'Petunjuk',
    ]);
    const sheet = workbook.getWorksheet('Prioritas')!;
    const header: string[] = [];
    sheet.getRow(1).eachCell((cell, column) => {
      header[column] = cell.text;
    });
    const col = (title: string) => header.indexOf(title);
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const division = row.getCell(col('Divisi')).text;
      const id = row.getCell(col('ID (jangan diubah)')).text;
      if (division === 'Logistik') {
        row.getCell(col('Urutan')).value = id === y.id ? 1 : 2;
      }
    }
    const filled = await workbook.xlsx.writeBuffer();

    await importFile(s.admin, s, filled as ArrayBuffer, 'isian.xlsx');
    expect(await ranksOf(s.admin, s, s.logistik.id)).toEqual({
      [y.id]: { rank: 1, note: null },
      // Awalan pengaman rumus dibuang lagi: keterangan tidak berubah.
      [x.id]: { rank: 2, note: '=bukan rumus' },
    });
    // IT ada di file dengan urutan kosong: tetap kosong, versi tidak naik.
    expect((await board(s.admin, s, s.it.id)).version).toBe(0);
  });

  it('CSV bertitik koma dari Excel berbahasa Indonesia terbaca', async () => {
    const table = await readSheet(
      'isian.csv',
      Buffer.from(
        `${String.fromCharCode(0xfeff)}Divisi;Urutan;ID\r\nLogistik;1;abc\r\n;;\r\n`,
        'utf8',
      ),
    );
    expect(table).toEqual([
      ['Divisi', 'Urutan', 'ID'],
      ['Logistik', '1', 'abc'],
    ]);
    await expect(
      readSheet('lama.xls', Buffer.from('bukan zip', 'utf8')),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('daftar berubah sejak pratinjau → CONFLICT; file bermasalah → BAD_REQUEST', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    const file = csv([
      ['Divisi', 'Urutan', 'ID'],
      ['Logistik', 1, x.id],
    ]);
    const p = await preview(s.admin, s, file);
    // Orang lain menyimpan dari papan setelah pratinjau.
    await s.admin.oprec.prioritySave({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      order: [y.id],
      baseVersion: 0,
    });
    await expect(
      s.admin.oprec.priorityImportApply({
        recruitmentId: s.recruitmentId,
        fileName: 'isian.csv',
        content: b64(file),
        versions: { [s.logistik.id]: p.divisions[0]!.version },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const broken = csv([
      ['Divisi', 'Urutan', 'ID'],
      ['Logistik', 1, x.id],
      ['Logistik', 1, y.id],
    ]);
    const bad = await preview(s.admin, s, broken);
    expect(bad.errorCount).toBe(1);
    await expect(
      s.admin.oprec.priorityImportApply({
        recruitmentId: s.recruitmentId,
        fileName: 'isian.csv',
        content: b64(broken),
        versions: { [s.logistik.id]: 1 },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await ranksOf(s.admin, s, s.logistik.id)).toMatchObject({
      [y.id]: { rank: 1 },
      [x.id]: { rank: null },
    });
  });

  it('hak per divisi, daftar terkunci, dan metode manual', async () => {
    const s = await setup();
    const x = await apply(s.recruitmentId, [s.logistik.id, s.it.id]);
    const file = csv([
      ['Divisi', 'Urutan', 'ID'],
      ['Logistik', 1, x.id],
    ]);
    // Metode manual: impor ditolak.
    await expect(preview(s.admin, s, file)).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    await usePriority(s);
    const itHead = callerFor(s.heads[1]!);
    const denied = await preview(itHead, s, file);
    expect(denied.errors.map((e) => e.message)).toEqual([
      'Kamu tidak menyusun daftar Logistik.',
    ]);
    await expect(
      itHead.oprec.priorityImportApply({
        recruitmentId: s.recruitmentId,
        fileName: 'isian.csv',
        content: b64(file),
        versions: { [s.logistik.id]: 0 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Kadiv IT boleh mengimpor divisinya sendiri.
    await importFile(
      itHead,
      s,
      csv([
        ['Divisi', 'Urutan', 'ID'],
        ['IT', 1, x.id],
      ]),
    );
    expect((await ranksOf(s.admin, s, s.it.id))[x.id]).toEqual({
      rank: 1,
      note: null,
    });

    // Daftar terkunci tidak bisa diimpor.
    await s.admin.oprec.setStatus({
      recruitmentId: s.recruitmentId,
      status: 'open',
    });
    await s.admin.oprec.setStatus({
      recruitmentId: s.recruitmentId,
      status: 'closed',
    });
    await s.admin.oprec.priorityLock({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      locked: true,
    });
    const locked = await preview(s.admin, s, file);
    expect(locked.errors[0]!.message).toContain('sudah dikunci');
  });

  it('keterangan kosong menghapus; kandidat tidak lolos diabaikan urutannya', async () => {
    const s = await setup();
    await usePriority(s);
    const x = await apply(s.recruitmentId, [s.logistik.id]);
    const y = await apply(s.recruitmentId, [s.logistik.id]);
    await s.admin.oprec.priorityNote({
      recruitmentId: s.recruitmentId,
      divisionId: s.logistik.id,
      applicationId: x.id,
      note: 'catatan lama',
    });
    await db.insert(choiceStatusOverride).values({
      choiceId: y.choices[0]!.id,
      status: 'tidak_lolos',
      reason: 'Gugur berkas',
      setBy: s.w.owner.id,
    });
    const file = csv([
      ['Divisi', 'Urutan', 'Keterangan', 'ID'],
      ['Logistik', '', '', x.id],
      ['Logistik', 1, '', y.id],
    ]);
    const p = await preview(s.admin, s, file);
    expect(p.errorCount).toBe(0);
    expect(p.warnings.map((w) => w.message)).toEqual([
      'Pendaftar ini tidak lolos di Logistik, jadi urutannya diabaikan.',
    ]);
    await importFile(s.admin, s, file);
    const rows = await db
      .select()
      .from(divisionPriority)
      .where(eq(divisionPriority.divisionId, s.logistik.id));
    expect(rows).toEqual([]);
  });
});
