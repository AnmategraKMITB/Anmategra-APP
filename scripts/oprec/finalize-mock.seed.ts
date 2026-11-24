/**
 * Melengkapi mock oprec: terima pilihan "lolos" sesuai kuota, tolak sisanya,
 * tetapkan final, aktifkan hasil ke pendaftar. Rilis TIDAK dilakukan (lakukan
 * lewat UI menu Hasil agar pemberitahuan dan jadwal bisa dicoba).
 *   MOCK_RECRUITMENT=<id> DATABASE_URL=... SKIP_ENV_VALIDATION=1 bun --config=scripts/oprec/bunfig.seed.toml test ./scripts/oprec/finalize-mock.seed.ts
 */
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { it } from 'vitest';
import { oprecRouter } from '~/server/api/routers/oprec';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import * as schema from '~/server/db/schema';

it('finalisasi mock', async () => {
  const id = process.env.MOCK_RECRUITMENT!;
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });
  const [rec] = await db
    .select()
    .from(schema.recruitment)
    .where(eq(schema.recruitment.id, id));
  const [period] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, rec!.periodId));
  const [lembaga] = await db
    .select()
    .from(schema.lembaga)
    .where(eq(schema.lembaga.id, period!.org_id!));
  const caller = createCallerFactory(createTRPCRouter({ oprec: oprecRouter }))({
    db,
    session: {
      user: { id: lembaga!.userId, role: 'lembaga', lembagaId: lembaga!.id },
      expires: '',
    },
    headers: new Headers(),
  } as never);

  const rows = await db
    .select({
      id: schema.applicationChoice.id,
      applicationId: schema.applicationChoice.applicationId,
      status: schema.applicationChoice.computedStatus,
      rank: schema.applicationChoice.rank,
    })
    .from(schema.applicationChoice)
    .innerJoin(
      schema.application,
      eq(schema.application.id, schema.applicationChoice.applicationId),
    )
    .where(eq(schema.application.recruitmentId, id))
    .orderBy(asc(schema.applicationChoice.rank));
  const accepted = new Set<string>();
  let ok = 0;
  for (const r of rows) {
    const take = r.status === 'lolos' && !accepted.has(r.applicationId);
    try {
      await caller.oprec.decide({
        recruitmentId: id,
        choiceId: r.id,
        decision: take ? 'terima' : 'tolak',
      });
      if (take) {
        accepted.add(r.applicationId);
        ok++;
      }
    } catch (e) {
      console.log('lewati', r.id, (e as Error).message);
    }
  }
  await db
    .update(schema.recruitment)
    .set({ resultsVisibleToApplicants: true })
    .where(eq(schema.recruitment.id, id));
  for (const state of ['masa_banding', 'final'] as const) {
    await caller.oprec
      .setPlacementState({
        recruitmentId: id,
        state,
        resolution: 'setujui_semua',
      } as never)
      .catch((e: Error) => console.log(state, 'gagal:', e.message));
  }
  console.log('diterima:', ok);
  await client.end();
}, 120_000);
