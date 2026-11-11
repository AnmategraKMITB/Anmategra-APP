/**
 * Backfill organogram: mengimpor semua keanggotaan/kehimpunan lama ke organogram dengan usulan
 * bawaan (tanpa keputusan manual), sebelum aplikasi membaca anggota dari organogram.
 *
 * - Lembaga yang punya kehimpunan tetapi belum punya periode kepengurusan mendapat "2025/2026".
 * - Periode yang organogramnya sudah berisi dilewati (aman dijalankan ulang).
 * - Tabel lama tidak diubah. Di akhir, `participant_count` dan `member_count` dihitung ulang.
 *
 * Pemakaian (dari akar repo, DATABASE_URL menunjuk ke basis data sasaran):
 *   SKIP_ENV_VALIDATION=1 DATABASE_URL=... \
 *     npx tsx --tsconfig scripts/organogram/tsconfig.json scripts/organogram/backfill.ts --dry
 *
 * `--dry` menjalankan semuanya lalu me-rollback; hanya melaporkan jumlah.
 */
import { sql } from 'drizzle-orm';
import { organizationRouter } from '~/server/api/routers/organization';
import { createCallerFactory } from '~/server/api/trpc';
import { db } from '~/server/db';
import { events, keanggotaan, kehimpunan, lembaga } from '~/server/db/schema';

const DRY = process.argv.includes('--dry');

class Rollback extends Error {}
const makeCaller = createCallerFactory(organizationRouter);

async function main() {
  const report = {
    periodsCreated: 0,
    imported: 0,
    skippedFilled: 0,
    skippedEmpty: 0,
    units: 0,
    positions: 0,
    placements: 0,
  };

  try {
    await db.transaction(async (tx) => {
      const d = tx as unknown as typeof db;
      const owners = new Map(
        (
          await tx
            .select({ id: lembaga.id, userId: lembaga.userId })
            .from(lembaga)
        ).map((l) => [l.id, l.userId]),
      );
      // Setiap pemanggilan berjalan sebagai pemilik lembaganya, jadi aturan akses router tetap berlaku.
      const as = (lembagaId: string) =>
        makeCaller({
          db: d,
          session: {
            user: {
              id: owners.get(lembagaId)!,
              role: 'lembaga',
              lembagaId,
              name: 'backfill',
              email: 'backfill@localhost',
            },
            expires: '2999-01-01',
          } as never,
          headers: new Headers(),
        });

      // 1. Lembaga yang punya kehimpunan tetapi belum punya periode kepengurusan.
      const withMembers = await tx
        .selectDistinct({ id: kehimpunan.lembagaId })
        .from(kehimpunan);
      for (const { id } of withMembers) {
        const [has] = await tx
          .select({ id: events.id })
          .from(events)
          .where(
            sql`${events.org_id} = ${id} and ${events.kind} = 'kepengurusan'`,
          )
          .limit(1);
        if (!has) {
          await as(id).import.createCurrentPeriod({ lembagaId: id });
          report.periodsCreated++;
        }
      }

      // 2. Setiap periode: kegiatan dengan keanggotaan; kepengurusan dengan keanggotaan atau kehimpunan lembaganya.
      const periods = await tx
        .select({
          id: events.id,
          orgId: events.org_id,
          kind: events.kind,
          name: events.name,
        })
        .from(events);
      for (const p of periods) {
        if (!p.orgId) continue;
        const caller = as(p.orgId);
        const preview = await caller.import.preview({ periodId: p.id });
        if (preview.blocked === 'sudah_berisi') {
          report.skippedFilled++;
          continue;
        }
        if (preview.blocked === 'tidak_ada_data') {
          report.skippedEmpty++;
          continue;
        }
        const r = await caller.import.commit({
          periodId: p.id,
          fingerprint: preview.fingerprint,
          units: preview.plan.units.map((u) => ({ key: u.key, name: u.name })),
          positions: preview.plan.positions.map((x) => ({
            key: x.key,
            title: x.title,
            rank: x.rank,
            kind: x.kind,
          })),
        });
        report.imported++;
        report.units += r.units;
        report.positions += r.positions;
        report.placements += r.placements;
        console.log(
          `- ${p.kind} "${p.name}": ${r.units} bagian, ${r.positions} jabatan, ${r.placements} penempatan`,
        );
      }

      // 3. Hitung ulang penghitung turunan.
      await tx.execute(sql`UPDATE anmategra_lembaga_period p SET participant_count = (
        SELECT COUNT(DISTINCT pl.user_id) FROM anmategra_placement pl
        JOIN anmategra_organization_position po ON po.id = pl.position_id
        JOIN anmategra_organization_unit un ON un.id = po.unit_id
        JOIN anmategra_organization_structure s ON s.id = un.structure_id
        WHERE s.period_id = p.id AND s.is_active)`);
      await tx.execute(sql`UPDATE anmategra_lembaga l SET member_count = (
        SELECT COUNT(*) FROM anmategra_lembaga_membership m WHERE m.lembaga_id = l.id AND m.status = 'aktif')`);

      // 4. Pemeriksaan ringkas: jumlah pasangan (periode, orang) di tabel lama.
      const [kg] = await tx
        .select({
          n: sql<number>`count(distinct (${keanggotaan.event_id}, ${keanggotaan.user_id}))::int`,
        })
        .from(keanggotaan);
      console.log(
        'Ringkasan:',
        JSON.stringify(report),
        `| pasangan (periode, orang) di keanggotaan: ${kg?.n ?? 0}`,
      );
      if (DRY) throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
    console.log('--dry: semua perubahan di-rollback.');
  }
  process.exit(0);
}

void main();
