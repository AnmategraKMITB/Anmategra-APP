import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { oprecScopedProcedure } from '~/server/api/trpc';
import {
  mahasiswa,
  organizationPosition,
  organizationUnit,
  placement,
  recruitmentAssessor,
  recruitmentDivision,
  users,
} from '~/server/db/schema';

import { logAction } from './log';
import { conflict, notFound, pgCode } from './services';

const AssessorAddInput = z.object({
  recruitmentId: z.string().min(1),
  identifier: z.string().trim().min(1),
  divisionId: z.string().min(1).nullable().optional(),
});

const AssessorRemoveInput = z.object({
  recruitmentId: z.string().min(1),
  assessorId: z.string().min(1),
});

export const assessorProcedures = {
  assessorList: oprecScopedProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: recruitmentAssessor.id,
          userId: recruitmentAssessor.userId,
          name: users.name,
          email: users.email,
          nim: mahasiswa.nim,
          divisionId: recruitmentAssessor.divisionId,
          divisionName: organizationUnit.name,
        })
        .from(recruitmentAssessor)
        .innerJoin(users, eq(users.id, recruitmentAssessor.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, users.id))
        .leftJoin(
          recruitmentDivision,
          eq(recruitmentDivision.id, recruitmentAssessor.divisionId),
        )
        .leftJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(eq(recruitmentAssessor.recruitmentId, input.recruitmentId))
        .orderBy(asc(users.name));

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.name,
        email: row.email,
        nim: row.nim,
        divisionId: row.divisionId,
        divisionLabel:
          row.divisionId === null ? 'Umum' : (row.divisionName ?? 'Umum'),
      }));
    }),

  assessorAdd: oprecScopedProcedure
    .input(AssessorAddInput)
    .mutation(async ({ ctx, input }) => {
      const identifier = input.identifier.trim();
      let user: { id: string; name: string | null; email: string } | undefined;
      if (/^\d+$/.test(identifier)) {
        const [row] = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(mahasiswa)
          .innerJoin(users, eq(users.id, mahasiswa.userId))
          .where(eq(mahasiswa.nim, Number(identifier)));
        user = row;
      } else {
        const [row] = await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
          })
          .from(users)
          .where(sql`lower(${users.email}) = ${identifier.toLowerCase()}`);
        user = row;
      }
      if (!user) {
        notFound('Akun dengan email/NIM tersebut belum terdaftar di sistem.');
      }

      const divisionId = input.divisionId ?? null;
      if (divisionId !== null) {
        const [division] = await ctx.db
          .select({ id: recruitmentDivision.id })
          .from(recruitmentDivision)
          .where(
            and(
              eq(recruitmentDivision.id, divisionId),
              eq(recruitmentDivision.recruitmentId, input.recruitmentId),
            ),
          );
        if (!division) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Divisi itu bukan milik oprec ini.',
          });
        }
      }

      try {
        return await ctx.db.transaction(async (tx) => {
          const [duplicate] = await tx
            .select({ id: recruitmentAssessor.id })
            .from(recruitmentAssessor)
            .where(
              and(
                eq(recruitmentAssessor.recruitmentId, input.recruitmentId),
                eq(recruitmentAssessor.userId, user.id),
                divisionId === null
                  ? isNull(recruitmentAssessor.divisionId)
                  : eq(recruitmentAssessor.divisionId, divisionId),
              ),
            );
          if (duplicate) conflict('Penilai itu sudah terdaftar.');

          const [row] = await tx
            .insert(recruitmentAssessor)
            .values({
              recruitmentId: input.recruitmentId,
              userId: user.id,
              divisionId,
            })
            .returning({ id: recruitmentAssessor.id });
          await logAction(tx, {
            recruitmentId: input.recruitmentId,
            actorId: ctx.session.user.id,
            action: 'penilai_ditambah',
            entityType: 'recruitment_assessor',
            entityId: row!.id,
            detail: { userId: user.id, divisionId },
          });
          return { id: row!.id };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Penilai itu sudah terdaftar.');
        }
        throw error;
      }
    }),

  assessorRemove: oprecScopedProcedure
    .input(AssessorRemoveInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            id: recruitmentAssessor.id,
            userId: recruitmentAssessor.userId,
          })
          .from(recruitmentAssessor)
          .where(
            and(
              eq(recruitmentAssessor.id, input.assessorId),
              eq(recruitmentAssessor.recruitmentId, input.recruitmentId),
            ),
          )
          .for('update');
        if (!row) notFound('Penilai tidak ditemukan.');
        await tx
          .delete(recruitmentAssessor)
          .where(eq(recruitmentAssessor.id, input.assessorId));
        await logAction(tx, {
          recruitmentId: input.recruitmentId,
          actorId: ctx.session.user.id,
          action: 'penilai_dihapus',
          entityType: 'recruitment_assessor',
          entityId: input.assessorId,
          detail: { userId: row.userId },
        });
        return { success: true };
      });
    }),

  assessorDerived: oprecScopedProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          divisionId: recruitmentDivision.id,
          divisionLabel: organizationUnit.name,
          userId: users.id,
          name: users.name,
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .innerJoin(
          organizationPosition,
          eq(organizationPosition.unitId, recruitmentDivision.unitId),
        )
        .innerJoin(placement, eq(placement.positionId, organizationPosition.id))
        .innerJoin(users, eq(users.id, placement.userId))
        .where(
          and(
            eq(recruitmentDivision.recruitmentId, input.recruitmentId),
            eq(organizationPosition.rank, 'head'),
          ),
        )
        .orderBy(
          asc(recruitmentDivision.sortOrder),
          asc(organizationUnit.name),
          asc(users.name),
        );
    }),
};
