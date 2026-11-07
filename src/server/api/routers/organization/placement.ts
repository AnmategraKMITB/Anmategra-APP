import { TRPCError } from '@trpc/server';
import { and, eq, ne, sql } from 'drizzle-orm';
import { resolveOrganogramAccess } from '~/server/api/organization-access';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { type db as Db } from '~/server/db';
import {
  AddPlacementInputSchema,
  AddPlacementOutputSchema,
  MovePlacementInputSchema,
  MovePlacementOutputSchema,
  RemovePlacementInputSchema,
  RemovePlacementOutputSchema,
} from '~/server/api/types/organization.type';
import {
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  users,
} from '~/server/db/schema';

import { isUniqueViolation } from './services';

type Database = typeof Db;
type Actor = { id: string; role: string; lembagaId: string | null | undefined };

/** Posisi beserta unit dan struktur (periode) tempatnya berada. */
async function loadPositionContext(database: Database, positionId: string) {
  const [row] = await database
    .select({
      positionId: organizationPosition.id,
      title: organizationPosition.title,
      quota: organizationPosition.quota,
      unitId: organizationUnit.id,
      structureId: organizationStructure.id,
      periodId: organizationStructure.eventId,
      editLocked: organizationStructure.editLocked,
      isActive: organizationStructure.is_active,
    })
    .from(organizationPosition)
    .innerJoin(organizationUnit, eq(organizationPosition.unitId, organizationUnit.id))
    .innerJoin(organizationStructure, eq(organizationUnit.structure_id, organizationStructure.id))
    .where(eq(organizationPosition.id, positionId))
    .limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Posisi tidak ditemukan.' });
  if (!row.periodId || !row.isActive) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organogram posisi ini sudah tidak aktif.' });
  }
  return { ...row, periodId: row.periodId };
}
type PositionContext = Awaited<ReturnType<typeof loadPositionContext>>;

/** Pengelola boleh semuanya; anggota hanya di unit tempatnya (dan turunannya), dan tidak saat terkunci. */
async function assertCanEditPosition(database: Database, actor: Actor, ctx: PositionContext) {
  const unitRows = await database
    .select({ id: organizationUnit.id, parentId: organizationUnit.parent_id })
    .from(organizationUnit)
    .where(eq(organizationUnit.structure_id, ctx.structureId));
  const access = await resolveOrganogramAccess(
    database,
    actor,
    { id: ctx.structureId, periodId: ctx.periodId, editLocked: ctx.editLocked },
    unitRows,
  );
  if (access.isManager) return;
  if (ctx.editLocked) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Organogram sedang dikunci.' });
  }
  if (!access.memberUnitIds.has(ctx.unitId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Anda tidak berhak mengubah penempatan di unit ini.' });
  }
}

/** Jumlah penghuni yang dihitung terhadap kuota: placement closerec tidak dihitung. */
async function countOccupants(database: Database, positionId: string, excludePlacementId?: string) {
  const [row] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(placement)
    .where(
      and(
        eq(placement.positionId, positionId),
        ne(placement.source, 'closerec'),
        excludePlacementId ? ne(placement.id, excludePlacementId) : undefined,
      ),
    );
  return row?.n ?? 0;
}

export const organizationPlacementRouter = createTRPCRouter({
  /**
   * Menempatkan seorang pengguna di sebuah posisi. Bila kuota penuh, jawabannya
   * `{ ok: false, reason: 'quota_full' }` dan baris baru dibuat hanya jika klien
   * mengirim ulang dengan `allowOverQuota` setelah pengguna mengonfirmasi.
   */
  add: protectedProcedure
    .input(AddPlacementInputSchema)
    .output(AddPlacementOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const actor: Actor = { id: ctx.session.user.id, role: ctx.session.user.role, lembagaId: ctx.session.user.lembagaId };
      return ctx.db.transaction(async (tx) => {
        const db = tx as unknown as typeof ctx.db;
        const position = await loadPositionContext(db, input.positionId);
        await assertCanEditPosition(db, actor, position);

        const target = await tx.query.users.findFirst({ where: eq(users.id, input.userId), columns: { id: true } });
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan.' });

        // Kunci baris posisi: dua penambahan bersamaan ke posisi yang sama dijalankan bergantian.
        await tx
          .select({ id: organizationPosition.id })
          .from(organizationPosition)
          .where(eq(organizationPosition.id, input.positionId))
          .for('update');

        if (input.source !== 'closerec' && position.quota > 0 && !input.allowOverQuota) {
          const count = await countOccupants(db, input.positionId);
          if (count >= position.quota) {
            return { ok: false as const, reason: 'quota_full' as const, count, quota: position.quota };
          }
        }
        try {
          const [row] = await tx
            .insert(placement)
            .values({
              positionId: input.positionId,
              userId: input.userId,
              source: input.source,
              note: input.note ?? null,
              createdBy: actor.id,
            })
            .returning({ id: placement.id });
          return { ok: true as const, id: row!.id };
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Pengguna sudah menempati posisi ini.' });
          }
          throw error;
        }
      });
    }),

  remove: protectedProcedure
    .input(RemovePlacementInputSchema)
    .output(RemovePlacementOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const actor: Actor = { id: ctx.session.user.id, role: ctx.session.user.role, lembagaId: ctx.session.user.lembagaId };
      const [row] = await ctx.db
        .select({ positionId: placement.positionId })
        .from(placement)
        .where(eq(placement.id, input.placementId))
        .limit(1);
      if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Penempatan tidak ditemukan.' });
      const position = await loadPositionContext(ctx.db, row.positionId);
      await assertCanEditPosition(ctx.db, actor, position);
      await ctx.db.delete(placement).where(eq(placement.id, input.placementId));
      return { success: true };
    }),

  /** Memindahkan penempatan ke posisi lain di organogram yang sama. */
  move: protectedProcedure
    .input(MovePlacementInputSchema)
    .output(MovePlacementOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const actor: Actor = { id: ctx.session.user.id, role: ctx.session.user.role, lembagaId: ctx.session.user.lembagaId };
      return ctx.db.transaction(async (tx) => {
        const db = tx as unknown as typeof ctx.db;
        const [current] = await tx
          .select({ id: placement.id, positionId: placement.positionId, source: placement.source })
          .from(placement)
          .where(eq(placement.id, input.placementId))
          .limit(1);
        if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Penempatan tidak ditemukan.' });
        if (current.positionId === input.toPositionId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Penempatan sudah berada di posisi tersebut.' });
        }
        const from = await loadPositionContext(db, current.positionId);
        const to = await loadPositionContext(db, input.toPositionId);
        if (from.structureId !== to.structureId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Posisi tujuan harus berada di organogram yang sama.' });
        }
        await assertCanEditPosition(db, actor, from);
        await assertCanEditPosition(db, actor, to);

        await tx
          .select({ id: organizationPosition.id })
          .from(organizationPosition)
          .where(eq(organizationPosition.id, input.toPositionId))
          .for('update');

        if (current.source !== 'closerec' && to.quota > 0 && !input.allowOverQuota) {
          const count = await countOccupants(db, input.toPositionId, input.placementId);
          if (count >= to.quota) {
            return { ok: false as const, reason: 'quota_full' as const, count, quota: to.quota };
          }
        }
        try {
          await tx
            .update(placement)
            .set({ positionId: input.toPositionId, updated_at: new Date() })
            .where(eq(placement.id, input.placementId));
          return { ok: true as const, id: input.placementId };
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Pengguna sudah menempati posisi tujuan.' });
          }
          throw error;
        }
      });
    }),
});
