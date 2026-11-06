import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { canManageEvent } from '~/server/api/access';
import { resolveOrganogramAccess } from '~/server/api/organization-access';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { type db as Db } from '~/server/db';
import {
  CreateOrganogramInputSchema,
  CreateOrganogramOutputSchema,
  GetOrganogramInputSchema,
  GetOrganogramOutputSchema,
  SaveOrganogramInputSchema,
  SaveOrganogramOutputSchema,
  SetOrganogramLockInputSchema,
  SetOrganogramLockOutputSchema,
} from '~/server/api/types/organization.type';
import {
  events,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  users,
} from '~/server/db/schema';

import { isForeignKeyViolation, isUniqueViolation } from './services';
import {
  type PositionNode,
  type Tree,
  type UnitNode,
  checkMemberEdit,
  computeLevels,
  diffTrees,
  isEmptyDiff,
  validateTree,
} from './tree';

type Reader = Pick<typeof Db, 'select' | 'query'>;

const activeStructureOf = (periodId: string) =>
  and(
    eq(organizationStructure.eventId, periodId),
    eq(organizationStructure.is_active, true),
  );

async function loadTree(database: Reader, structureId: string) {
  const unitRows = await database
    .select()
    .from(organizationUnit)
    .where(eq(organizationUnit.structure_id, structureId));
  const unitIds = unitRows.map((u) => u.id);
  const positionRows =
    unitIds.length === 0
      ? []
      : await database
          .select()
          .from(organizationPosition)
          .where(inArray(organizationPosition.unitId, unitIds));

  const storedLevels = new Map(unitRows.map((u) => [u.id, u.level]));
  const units: UnitNode[] = unitRows.map((u) => ({
    id: u.id,
    parentId: u.parent_id,
    name: u.name,
    typeLabel: u.typeLabel ?? u.kind ?? null,
    sortOrder: u.sort_order,
    layout: u.layout ?? null,
  }));
  const positions: PositionNode[] = positionRows.map((p) => ({
    id: p.id,
    unitId: p.unitId,
    title: p.title,
    rank: p.rank,
    kind: p.kind,
    quota: p.quota,
    hidden: p.hidden,
    sortOrder: p.sort_order,
  }));
  return { tree: { units, positions } satisfies Tree, storedLevels };
}

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const organizationStructureRouter = createTRPCRouter({
  /** Seluruh organogram sebuah periode dalam satu panggilan; null bila belum dibuat. */
  get: protectedProcedure
    .input(GetOrganogramInputSchema)
    .output(GetOrganogramOutputSchema)
    .query(async ({ ctx, input }) => {
      const period = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.periodId),
        columns: { id: true },
      });
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Periode tidak ditemukan.' });
      }
      const [structure] = await ctx.db
        .select()
        .from(organizationStructure)
        .where(activeStructureOf(input.periodId))
        .limit(1);
      if (!structure) return null;

      const { tree } = await loadTree(ctx.db, structure.id);

      const placementRows = await ctx.db
        .select({
          id: placement.id,
          positionId: placement.positionId,
          userId: placement.userId,
          source: placement.source,
          note: placement.note,
          name: users.name,
          image: users.image,
        })
        .from(placement)
        .innerJoin(users, eq(placement.userId, users.id))
        .innerJoin(organizationPosition, eq(placement.positionId, organizationPosition.id))
        .innerJoin(organizationUnit, eq(organizationPosition.unitId, organizationUnit.id))
        .where(eq(organizationUnit.structure_id, structure.id));
      const byPosition = new Map<string, typeof placementRows>();
      for (const row of placementRows) {
        byPosition.set(row.positionId, [...(byPosition.get(row.positionId) ?? []), row]);
      }

      const access = await resolveOrganogramAccess(
        ctx.db,
        {
          id: ctx.session.user.id,
          role: ctx.session.user.role,
          lembagaId: ctx.session.user.lembagaId,
        },
        { id: structure.id, periodId: input.periodId, editLocked: structure.editLocked },
        tree.units,
      );

      return {
        id: structure.id,
        periodId: input.periodId,
        name: structure.name,
        levelLabels: structure.levelLabels ?? null,
        rankLabels: structure.rankLabels ?? null,
        editLocked: structure.editLocked,
        lockedBy: structure.lockedBy,
        lockedAt: structure.lockedAt,
        version: structure.version,
        units: tree.units,
        positions: tree.positions.map((p) => ({
          ...p,
          placements: (byPosition.get(p.id) ?? []).map((r) => ({
            id: r.id,
            userId: r.userId,
            name: r.name,
            image: r.image,
            source: r.source,
            note: r.note,
          })),
        })),
        access: {
          canManage: access.isManager,
          canEdit: access.canEdit,
          canLock: access.canLock,
          editableUnitIds: access.isManager ? null : [...access.memberUnitIds],
        },
      };
    }),

  /** Membuat organogram kosong untuk sebuah periode. Hanya pengelola. */
  create: protectedProcedure
    .input(CreateOrganogramInputSchema)
    .output(CreateOrganogramOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      const period = await ctx.db.query.events.findFirst({
        where: eq(events.id, input.periodId),
        columns: { id: true, name: true },
      });
      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Periode tidak ditemukan.' });
      }
      const access = await canManageEvent(ctx.db, user.id, user.role, user.lembagaId, input.periodId);
      if (!access) throw new TRPCError({ code: 'FORBIDDEN' });

      const [existing] = await ctx.db
        .select({ id: organizationStructure.id })
        .from(organizationStructure)
        .where(activeStructureOf(input.periodId))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Periode ini sudah punya organogram.' });
      }

      try {
        const [row] = await ctx.db
          .insert(organizationStructure)
          .values({ eventId: input.periodId, name: input.name ?? period.name, is_active: true })
          .returning({ id: organizationStructure.id, version: organizationStructure.version });
        return row!;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Periode ini sudah punya organogram.',
          });
        }
        throw error;
      }
    }),

  /**
   * Menyimpan seluruh pohon yang diedit. Satu transaksi: kunci baris struktur,
   * cek hak dan versi, validasi, hitung selisih, terapkan. Urutan penerapan dipilih
   * agar kunci asing tidak pernah putus di tengah jalan: unit baru, ubah/pindah unit,
   * posisi baru, ubah posisi, hapus posisi, terakhir hapus unit.
   */
  save: protectedProcedure
    .input(SaveOrganogramInputSchema)
    .output(SaveOrganogramOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      try {
        return await ctx.db.transaction(async (tx) => {
          const [structure] = await tx
            .select()
            .from(organizationStructure)
            .where(activeStructureOf(input.periodId))
            .limit(1)
            .for('update');
          if (!structure) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Organogram belum dibuat untuk periode ini.' });
          }

          const { tree: current, storedLevels } = await loadTree(tx, structure.id);
          const access = await resolveOrganogramAccess(
            tx as unknown as typeof ctx.db,
            { id: user.id, role: user.role, lembagaId: user.lembagaId },
            { id: structure.id, periodId: input.periodId, editLocked: structure.editLocked },
            current.units,
          );
          if (!access.canEdit) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                !access.isManager && structure.editLocked
                  ? 'Organogram sedang dikunci.'
                  : 'Anda tidak berhak mengubah organogram ini.',
            });
          }
          if (input.expectedVersion !== structure.version) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Organogram sudah diubah orang lain sejak Anda membukanya. Muat ulang dulu.',
            });
          }

          const next: Tree = {
            units: input.units.map((u) => ({
              id: u.id,
              parentId: u.parentId,
              name: u.name.trim(),
              typeLabel: u.typeLabel === null || u.typeLabel.trim() === '' ? null : u.typeLabel.trim(),
              sortOrder: u.sortOrder,
              layout: u.layout,
            })),
            positions: input.positions.map((p) => ({ ...p, title: p.title.trim() })),
          };
          const problems = validateTree(next);
          if (problems.length > 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: problems.slice(0, 5).join(' ') });
          }

          const diff = diffTrees(current, next);
          const levels = computeLevels(next.units);

          const nameChanged = input.name !== undefined && input.name !== structure.name;
          const levelLabelsChanged =
            input.levelLabels !== undefined && !sameJson(input.levelLabels, structure.levelLabels);
          const rankLabelsChanged =
            input.rankLabels !== undefined && !sameJson(input.rankLabels, structure.rankLabels);
          const structureFieldsChanged = nameChanged || levelLabelsChanged || rankLabelsChanged;

          if (!access.isManager) {
            if (structureFieldsChanged) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: 'Hanya pengelola yang boleh mengubah nama dan label organogram.',
              });
            }
            const denied = checkMemberEdit(diff, next, access.memberUnitIds);
            if (denied) throw new TRPCError({ code: 'FORBIDDEN', message: denied });
          }

          // Level (kedalaman) bisa berubah pada turunan unit yang dipindah.
          const levelUpdates = next.units.filter(
            (u) => storedLevels.has(u.id) && storedLevels.get(u.id) !== levels.get(u.id),
          );
          const changedUnitIds = new Set([
            ...diff.unitsToUpdate.map((c) => c.after.id),
            ...levelUpdates.map((u) => u.id),
          ]);

          if (isEmptyDiff(diff) && changedUnitIds.size === 0 && !structureFieldsChanged) {
            return { version: structure.version, changed: false };
          }

          // Posisi yang akan dihapus tidak boleh masih berpenghuni.
          if (diff.positionsToDelete.length > 0) {
            const occupied = await tx
              .select({ positionId: placement.positionId, n: sql<number>`count(*)::int` })
              .from(placement)
              .where(inArray(placement.positionId, diff.positionsToDelete.map((p) => p.id)))
              .groupBy(placement.positionId);
            if (occupied.length > 0) {
              const titleById = new Map(diff.positionsToDelete.map((p) => [p.id, p.title]));
              const list = occupied
                .map((o) => `"${titleById.get(o.positionId) ?? o.positionId}" (${o.n} orang)`)
                .join(', ');
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Posisi masih berpenghuni: ${list}. Pindahkan atau hapus penempatannya dulu.`,
              });
            }
          }

          if (diff.unitsToInsert.length > 0) {
            await tx.insert(organizationUnit).values(
              diff.unitsToInsert.map((u) => ({
                id: u.id,
                structure_id: structure.id,
                parent_id: u.parentId,
                name: u.name,
                kind: null,
                level: levels.get(u.id)!,
                sort_order: u.sortOrder,
                typeLabel: u.typeLabel,
                layout: u.layout,
              })),
            );
          }
          const nextById = new Map(next.units.map((u) => [u.id, u]));
          for (const id of changedUnitIds) {
            const u = nextById.get(id)!;
            await tx
              .update(organizationUnit)
              .set({
                parent_id: u.parentId,
                name: u.name,
                typeLabel: u.typeLabel,
                sort_order: u.sortOrder,
                layout: u.layout,
                level: levels.get(id)!,
                updated_at: new Date(),
              })
              .where(and(eq(organizationUnit.id, id), eq(organizationUnit.structure_id, structure.id)));
          }
          if (diff.positionsToInsert.length > 0) {
            await tx.insert(organizationPosition).values(
              diff.positionsToInsert.map((p) => ({
                id: p.id,
                unitId: p.unitId,
                title: p.title,
                rank: p.rank,
                kind: p.kind,
                quota: p.quota,
                hidden: p.hidden,
                sort_order: p.sortOrder,
              })),
            );
          }
          for (const { after: p } of diff.positionsToUpdate) {
            await tx
              .update(organizationPosition)
              .set({
                unitId: p.unitId,
                title: p.title,
                rank: p.rank,
                kind: p.kind,
                quota: p.quota,
                hidden: p.hidden,
                sort_order: p.sortOrder,
                updated_at: new Date(),
              })
              .where(eq(organizationPosition.id, p.id));
          }
          if (diff.positionsToDelete.length > 0) {
            await tx
              .delete(organizationPosition)
              .where(inArray(organizationPosition.id, diff.positionsToDelete.map((p) => p.id)));
          }
          if (diff.unitsToDelete.length > 0) {
            await tx
              .delete(organizationUnit)
              .where(inArray(organizationUnit.id, diff.unitsToDelete.map((u) => u.id)));
          }

          const [updated] = await tx
            .update(organizationStructure)
            .set({
              version: sql`${organizationStructure.version} + 1`,
              updated_at: new Date(),
              ...(nameChanged ? { name: input.name } : {}),
              ...(levelLabelsChanged ? { levelLabels: input.levelLabels } : {}),
              ...(rankLabelsChanged ? { rankLabels: input.rankLabels } : {}),
            })
            .where(eq(organizationStructure.id, structure.id))
            .returning({ version: organizationStructure.version });
          return { version: updated!.version, changed: true };
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Id unit atau posisi sudah dipakai di tempat lain. Gunakan id baru.',
          });
        }
        if (isForeignKeyViolation(error)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Perubahan ditolak karena masih ada keterkaitan data (mis. posisi berpenghuni).',
          });
        }
        throw error;
      }
    }),

  /** Mengunci atau membuka edit. Pengelola, atau pemegang posisi head di unit akar. */
  setLock: protectedProcedure
    .input(SetOrganogramLockInputSchema)
    .output(SetOrganogramLockOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session.user;
      const [structure] = await ctx.db
        .select()
        .from(organizationStructure)
        .where(activeStructureOf(input.periodId))
        .limit(1);
      if (!structure) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Organogram belum dibuat untuk periode ini.' });
      }
      const { tree } = await loadTree(ctx.db, structure.id);
      const access = await resolveOrganogramAccess(
        ctx.db,
        { id: user.id, role: user.role, lembagaId: user.lembagaId },
        { id: structure.id, periodId: input.periodId, editLocked: structure.editLocked },
        tree.units,
      );
      if (!access.canLock) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya pengelola atau ketua (posisi head di unit akar) yang boleh mengunci organogram.',
        });
      }
      await ctx.db
        .update(organizationStructure)
        .set({
          editLocked: input.locked,
          lockedBy: input.locked ? user.id : null,
          lockedAt: input.locked ? new Date() : null,
          updated_at: new Date(),
        })
        .where(eq(organizationStructure.id, structure.id));
      return { editLocked: input.locked };
    }),
});
