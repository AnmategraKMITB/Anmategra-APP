import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { formRouter } from '~/server/api/routers/form';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { createOprecWorld as baseWorld, placeAt } from '~/test/oprec-fixtures';
import {
  TEST_DATABASE_URL,
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import { oprecRouter } from '.';
import { checkApplyGate, loadOprecForForm } from './application';

const { db, close } = createTestDb();
beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

const hasPsql = spawnSync('psql', ['--version']).status === 0;
const SCRIPT = path.resolve('scripts/oprec/set-angkatan.sql');
const appRouter = createTRPCRouter({ oprec: oprecRouter, form: formRouter });

function runScript(vars: Record<string, string | number>) {
  const args = Object.entries(vars).flatMap(([k, v]) => ['-v', `${k}=${v}`]);
  return spawnSync('psql', [TEST_DATABASE_URL, ...args, '-f', SCRIPT], {
    encoding: 'utf8',
  });
}

describe.skipIf(!hasPsql)('scripts/oprec/set-angkatan.sql', () => {
  async function openOprec() {
    const w = await baseWorld(db);
    for (const u of w.units) {
      await placeAt(db, u.headPositionId, (await createUser(db)).id);
    }
    const caller = createCallerFactory(appRouter)({
      db,
      session: { user: { ...w.owner }, expires: '' },
      headers: new Headers(),
    } as never);
    const { recruitmentId, formId } = await caller.oprec.createFromSetup({
      eventId: w.eventId,
      name: 'Aku Masuk ITB',
      form: { mode: 'template' as const },
      divisions: w.units.map((u) => ({
        unitId: u.unitId,
        positionId: u.staffPositionId,
      })),
      minChoices: 1,
      maxChoices: 2,
    });
    await caller.oprec.setStatus({ recruitmentId, status: 'open' });
    return { recruitmentId, formId };
  }

  async function canApply(formId: string, angkatan: number) {
    const user = await createUser(db);
    await createMahasiswa(db, user.id, { angkatan });
    const oprec = await loadOprecForForm(db, formId);
    return (await checkApplyGate(db, oprec!, user.id)).canApply;
  }

  it('mengubah syarat angkatan pada oprec yang sudah dibuka', async () => {
    const { recruitmentId, formId } = await openOprec();
    expect(await canApply(formId, 2023)).toBe(true); // belum ada syarat

    const out = runScript({
      oprec_id: recruitmentId,
      dari: 2024,
      sampai: 2025,
    });
    expect(out.status, out.stderr).toBe(0);

    expect(await canApply(formId, 2023)).toBe(false);
    expect(await canApply(formId, 2024)).toBe(true);
    expect(await canApply(formId, 2025)).toBe(true);
    expect(await canApply(formId, 2026)).toBe(false);

    // Dijalankan ulang menggantikan, bukan menumpuk.
    const again = runScript({
      oprec_id: recruitmentId,
      dari: 2024,
      sampai: 2026,
    });
    expect(again.status, again.stderr).toBe(0);
    expect(await canApply(formId, 2026)).toBe(true);
  });

  it('menolak id tak dikenal dan rentang terbalik tanpa mengubah apa pun', async () => {
    const { recruitmentId, formId } = await openOprec();
    const bad = runScript({ oprec_id: 'tidak-ada', dari: 2024, sampai: 2025 });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('tidak ditemukan');
    const reversed = runScript({
      oprec_id: recruitmentId,
      dari: 2026,
      sampai: 2024,
    });
    expect(reversed.status).not.toBe(0);
    expect(await canApply(formId, 2023)).toBe(true);
  });

  it('ROLLBACK tidak menyimpan perubahan', async () => {
    const { recruitmentId, formId } = await openOprec();
    const out = runScript({
      oprec_id: recruitmentId,
      dari: 2024,
      sampai: 2025,
      selesai: 'ROLLBACK',
    });
    expect(out.status, out.stderr).toBe(0);
    expect(await canApply(formId, 2023)).toBe(true);
  });
});
