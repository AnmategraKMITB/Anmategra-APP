import { TRPCError } from '@trpc/server';
import { and, asc, count, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { canManageEvent, canManageLembaga } from '~/server/api/access';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import {
  ApplyImportInputSchema,
  ApplyImportOutputSchema,
  CreateCurrentPeriodInputSchema,
  CreateCurrentPeriodOutputSchema,
  PreviewImportInputSchema,
  PreviewImportOutputSchema,
} from '~/server/api/types/organization.type';
import { type db as Db } from '~/server/db';
import {
  events,
  keanggotaan,
  kehimpunan,
  lembaga,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
} from '~/server/db/schema';

import {
  type FinalPlan,
  type LegacyRow,
  applyDecisions,
  planImport,
} from './import-plan';

type Reader = Pick<typeof Db, 'select' | 'query'>;

const INSERT_CHUNK = 500;

/**
 * Baris teks lama untuk sebuah periode: keanggotaan milik periode itu, dan
 * untuk periode kepengurusan juga kehimpunan lembaganya (kehimpunan tidak
 * punya periode). Diurutkan supaya kunci usulan stabil antar pemanggilan.
 */
async function loadLegacyRows(
  database: Reader,
  period: { id: string; kind: string; org_id: string | null },
) {
  const fromKeanggotaan = await database
    .select({
      userId: keanggotaan.user_id,
      division: keanggotaan.division,
      position: keanggotaan.position,
      index: keanggotaan.index,
    })
    .from(keanggotaan)
    .where(eq(keanggotaan.event_id, period.id))
    .orderBy(
      asc(keanggotaan.division),
      asc(keanggotaan.position),
      asc(keanggotaan.user_id),
    );
  const fromKehimpunan =
    period.kind === 'kepengurusan' && period.org_id
      ? await database
          .select({
            userId: kehimpunan.userId,
            division: kehimpunan.division,
            position: kehimpunan.position,
            index: kehimpunan.index,
          })
          .from(kehimpunan)
          .where(eq(kehimpunan.lembagaId, period.org_id))
          .orderBy(
            asc(kehimpunan.division),
            asc(kehimpunan.position),
            asc(kehimpunan.userId),
          )
      : [];
  const rows: LegacyRow[] = [...fromKeanggotaan, ...fromKehimpunan].sort(
    (a, b) =>
      a.division.localeCompare(b.division) ||
      a.position.localeCompare(b.position) ||
      a.userId.localeCompare(b.userId),
  );
  return {
    rows,
    sources: {
      keanggotaan: fromKeanggotaan.length,
      kehimpunan: fromKehimpunan.length,
    },
  };
}

const fingerprintOf = (plan: unknown) =>
  createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0, 24);

async function loadPeriod(database: Reader, periodId: string) {
  const period = await database.query.events.findFirst({
    where: eq(events.id, periodId),
    columns: { id: true, name: true, kind: true, org_id: true },
  });
  if (!period) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Periode tidak ditemukan.',
    });
  }
  return period;
}

/** Struktur aktif periode beserta jumlah unitnya; null bila belum dibuat. */
async function loadStructure(database: Reader, periodId: string) {
  const [structure] = await database
    .select({
      id: organizationStructure.id,
      version: organizationStructure.version,
    })
    .from(organizationStructure)
    .where(
      and(
        eq(organizationStructure.eventId, periodId),
        eq(organizationStructure.is_active, true),
      ),
    )
    .limit(1);
  if (!structure) return null;
  const [units] = await database
    .select({ n: count() })
    .from(organizationUnit)
    .where(eq(organizationUnit.structure_id, structure.id));
  return { ...structure, unitCount: units?.n ?? 0 };
}

export const organizationImportRouter = createTRPCRouter({
  /** Usulan unit, posisi, dan placement dari teks lama. Tidak menulis apa pun. */
  preview: protectedProcedure
    .input(PreviewImportInputSchema)
    .output(PreviewImportOutputSchema)
    .query(async ({ ctx, input }) => {
      const user = ctx.session.user;
      const period = await loadPeriod(ctx.db, input.periodId);
      const access = await canManageEvent(
        ctx.db,
        user.id,
        user.role,
        user.lembagaId,
        input.periodId,
      );
      if (!access) throw new TRPCError({ code: 'FORBIDDEN' });

      const { rows, sources } = await loadLegacyRows(ctx.db, period);
      const plan = planImport(rows);
      const structure = await loadStructure(ctx.db, input.periodId);
      const blocked =
        structure && structure.unitCount > 0
          ? ('sudah_berisi' as const)
          : plan.units.length === 0
            ? ('tidak_ada_data' as const)
            : null;
      return { sources, blocked, plan, fingerprint: fingerprintOf(plan) };
    }),

  /**
   * Menerapkan usulan setelah ditinjau. Satu transaksi: usulan dihitung ulang
   * dari data lama, sidiknya harus sama dengan pratinjau, lalu keputusan
   * (gabung, ganti nama, lewati) diterapkan dan unit, posisi, placement ditulis.
   */
  commit: protectedProcedure
    .input(ApplyImportInputSchema)
    .output(ApplyImportOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      const access = await canManageEvent(
        ctx.db,
        user.id,
        user.role,
        user.lembagaId,
        input.periodId,
      );
      if (!access) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.db.transaction(async (tx) => {
        const period = await loadPeriod(tx, input.periodId);
        const existing = await loadStructure(tx, input.periodId);
        if (existing && existing.unitCount > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Organogram periode ini sudah berisi.',
          });
        }

        const { rows } = await loadLegacyRows(tx, period);
        const plan = planImport(rows);
        if (fingerprintOf(plan) !== input.fingerprint) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'Data lama berubah sejak pratinjau. Buka lembar tinjauan lagi.',
          });
        }

        let final: FinalPlan;
        try {
          final = applyDecisions(plan, {
            units: input.units,
            positions: input.positions,
          });
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              error instanceof Error ? error.message : 'Keputusan tidak valid.',
          });
        }
        if (final.units.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tidak ada yang bisa diimpor.',
          });
        }

        let structureId: string;
        let version: number;
        if (existing) {
          structureId = existing.id;
          version = existing.version + 1;
          await tx
            .update(organizationStructure)
            .set({ version })
            .where(eq(organizationStructure.id, structureId));
        } else {
          const [created] = await tx
            .insert(organizationStructure)
            .values({
              eventId: period.id,
              name: period.name,
              is_active: true,
            })
            .returning({
              id: organizationStructure.id,
              version: organizationStructure.version,
            });
          structureId = created!.id;
          version = created!.version;
        }

        const unitIds = new Map(
          final.units.map((u) => [u.key, crypto.randomUUID()]),
        );
        const positionIds = new Map(
          final.positions.map((p) => [p.key, crypto.randomUUID()]),
        );

        await tx.insert(organizationUnit).values(
          final.units.map((u, index) => ({
            id: unitIds.get(u.key)!,
            structure_id: structureId,
            parent_id: null,
            name: u.name,
            level: 1,
            sort_order: index,
          })),
        );
        if (final.positions.length > 0) {
          await tx.insert(organizationPosition).values(
            final.positions.map((p, index) => ({
              id: positionIds.get(p.key)!,
              unitId: unitIds.get(p.unitKey)!,
              title: p.title,
              rank: p.rank,
              kind: p.kind,
              quota: 0,
              hidden: false,
              sort_order: index,
            })),
          );
        }
        for (let i = 0; i < final.placements.length; i += INSERT_CHUNK) {
          await tx.insert(placement).values(
            final.placements.slice(i, i + INSERT_CHUNK).map((pl) => ({
              positionId: positionIds.get(pl.positionKey)!,
              userId: pl.userId,
              source: 'import' as const,
              sortOrder: pl.order,
              createdBy: user.id,
            })),
          );
        }

        return {
          units: final.units.length,
          positions: final.positions.length,
          placements: final.placements.length,
          skippedPlacements: final.skippedPlacements,
          version,
        };
      });
    }),

  /**
   * Membuat periode kepengurusan bawaan "2025/2026" (On going) bagi lembaga
   * yang belum punya periode kepengurusan, sebagai tempat data kehimpunan.
   */
  createCurrentPeriod: protectedProcedure
    .input(CreateCurrentPeriodInputSchema)
    .output(CreateCurrentPeriodOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      const access = await canManageLembaga(
        ctx.db,
        user.id,
        user.role,
        user.lembagaId,
        input.lembagaId,
      );
      if (!access) throw new TRPCError({ code: 'FORBIDDEN' });

      return ctx.db.transaction(async (tx) => {
        const [org] = await tx
          .select({ id: lembaga.id, name: lembaga.name })
          .from(lembaga)
          .where(eq(lembaga.id, input.lembagaId))
          .for('update');
        if (!org) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Lembaga tidak ditemukan.',
          });
        }
        const [existing] = await tx
          .select({ id: events.id })
          .from(events)
          .where(
            and(
              eq(events.org_id, input.lembagaId),
              eq(events.kind, 'kepengurusan'),
            ),
          )
          .limit(1);
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Lembaga ini sudah punya periode kepengurusan.',
          });
        }
        const periodId = crypto.randomUUID();
        await tx.insert(events).values({
          id: periodId,
          org_id: org.id,
          kind: 'kepengurusan',
          label: '2025/2026',
          name: `${org.name} 2025/2026`,
          start_date: new Date('2025-08-01T00:00:00+07:00'),
          status: 'On going',
        });
        return { periodId };
      });
    }),
});
