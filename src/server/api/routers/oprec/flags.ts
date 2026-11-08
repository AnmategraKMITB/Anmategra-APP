import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { oprecAssessProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  applicationFlag,
  flagLabel,
  users,
} from '~/server/db/schema';

import { type Tx } from '../form/services';
import {
  type AssessAccess,
  canAssessScope,
  canSeeSensitive,
} from './assess-access';
import { logAction } from './log';
import { type Database, conflict, notFound, pgCode } from './services';

type Q = Tx | Database;

const FlagLabelSaveInput = z.object({
  recruitmentId: z.string().min(1),
  labelId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(255),
  color: z.enum(['teal', 'amber', 'blue', 'red']),
  isSensitive: z.boolean(),
});

const FlagLabelDeleteInput = z.object({
  recruitmentId: z.string().min(1),
  labelId: z.string().min(1),
});

const FlagApplyInput = z.object({
  recruitmentId: z.string().min(1),
  applicationId: z.string().min(1),
  labelId: z.string().min(1),
  note: z.string().max(1000).nullable().optional(),
});

const FlagRemoveInput = z.object({
  recruitmentId: z.string().min(1),
  applicationId: z.string().min(1),
  labelId: z.string().min(1),
});

const ApplicationFlagsInput = z.object({
  recruitmentId: z.string().min(1),
  applicationId: z.string().min(1),
});

function assertLabelManager(assess: AssessAccess) {
  if (!assess.isAdmin && assess.deciderDivisionIds.size === 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Hanya admin atau Kadiv yang boleh mengelola label.',
    });
  }
}

async function canAccessApplication(
  db: Q,
  assess: AssessAccess,
  applicationId: string,
): Promise<boolean> {
  if (assess.isAdmin) return true;
  if (canAssessScope(assess, null)) return true;
  if (assess.divisionIds.size === 0) return false;
  const [row] = await db
    .select({ id: applicationChoice.id })
    .from(applicationChoice)
    .where(
      and(
        eq(applicationChoice.applicationId, applicationId),
        inArray(applicationChoice.divisionId, [...assess.divisionIds]),
      ),
    )
    .limit(1);
  return row !== undefined;
}

async function assertApplicationAccess(
  db: Q,
  assess: AssessAccess,
  applicationId: string,
) {
  if (await canAccessApplication(db, assess, applicationId)) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Anda tidak punya akses ke pendaftar ini.',
  });
}

async function assertApplicationOfRecruitment(
  db: Q,
  recruitmentId: string,
  applicationId: string,
) {
  const [row] = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.id, applicationId),
        eq(application.recruitmentId, recruitmentId),
      ),
    );
  if (!row) notFound('Pendaftar tidak ditemukan pada oprec ini.');
  return row;
}

export const flagProcedures = {
  flagLabels: oprecAssessProcedure
    .input(z.object({ recruitmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: flagLabel.id,
          name: flagLabel.name,
          color: flagLabel.color,
          isSensitive: flagLabel.isSensitive,
          createdBy: flagLabel.createdBy,
        })
        .from(flagLabel)
        .where(
          and(
            eq(flagLabel.recruitmentId, input.recruitmentId),
            canSeeSensitive(ctx.assess)
              ? undefined
              : eq(flagLabel.isSensitive, false),
          ),
        )
        .orderBy(asc(flagLabel.name));
    }),

  flagLabelSave: oprecAssessProcedure
    .input(FlagLabelSaveInput)
    .mutation(async ({ ctx, input }) => {
      assertLabelManager(ctx.assess);
      const name = input.name.trim();
      try {
        return await ctx.db.transaction(async (tx) => {
          const [duplicate] = await tx
            .select({ id: flagLabel.id })
            .from(flagLabel)
            .where(
              and(
                eq(flagLabel.recruitmentId, input.recruitmentId),
                sql`lower(${flagLabel.name}) = ${name.toLowerCase()}`,
                input.labelId ? ne(flagLabel.id, input.labelId) : undefined,
              ),
            );
          if (duplicate) conflict('Label dengan nama itu sudah ada.');

          if (input.labelId) {
            const [existing] = await tx
              .select({ id: flagLabel.id })
              .from(flagLabel)
              .where(
                and(
                  eq(flagLabel.id, input.labelId),
                  eq(flagLabel.recruitmentId, input.recruitmentId),
                ),
              )
              .for('update');
            if (!existing) notFound('Label tidak ditemukan.');
            await tx
              .update(flagLabel)
              .set({
                name,
                color: input.color,
                isSensitive: input.isSensitive,
              })
              .where(eq(flagLabel.id, input.labelId));
            await logAction(tx, {
              recruitmentId: input.recruitmentId,
              actorId: ctx.session.user.id,
              action: 'label_disimpan',
              entityType: 'flag_label',
              entityId: input.labelId,
              detail: { isSensitive: input.isSensitive },
            });
            return { id: input.labelId };
          }

          const [row] = await tx
            .insert(flagLabel)
            .values({
              recruitmentId: input.recruitmentId,
              name,
              color: input.color,
              isSensitive: input.isSensitive,
              createdBy: ctx.session.user.id,
            })
            .returning({ id: flagLabel.id });
          await logAction(tx, {
            recruitmentId: input.recruitmentId,
            actorId: ctx.session.user.id,
            action: 'label_disimpan',
            entityType: 'flag_label',
            entityId: row!.id,
            detail: { isSensitive: input.isSensitive },
          });
          return { id: row!.id };
        });
      } catch (error) {
        if (pgCode(error) === '23505') {
          conflict('Label dengan nama itu sudah ada.');
        }
        throw error;
      }
    }),

  flagLabelDelete: oprecAssessProcedure
    .input(FlagLabelDeleteInput)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.assess.isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Hanya admin yang boleh menghapus label.',
        });
      }
      return ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .select({ id: flagLabel.id })
          .from(flagLabel)
          .where(
            and(
              eq(flagLabel.id, input.labelId),
              eq(flagLabel.recruitmentId, input.recruitmentId),
            ),
          )
          .for('update');
        if (!row) notFound('Label tidak ditemukan.');
        await tx.delete(flagLabel).where(eq(flagLabel.id, input.labelId));
        await logAction(tx, {
          recruitmentId: input.recruitmentId,
          actorId: ctx.session.user.id,
          action: 'label_dihapus',
          entityType: 'flag_label',
          entityId: input.labelId,
        });
        return { success: true };
      });
    }),

  flagApply: oprecAssessProcedure
    .input(FlagApplyInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const app = await assertApplicationOfRecruitment(
          tx,
          input.recruitmentId,
          input.applicationId,
        );
        const [label] = await tx
          .select()
          .from(flagLabel)
          .where(
            and(
              eq(flagLabel.id, input.labelId),
              eq(flagLabel.recruitmentId, input.recruitmentId),
            ),
          )
          .for('update');
        if (!label) notFound('Label tidak ditemukan.');
        if (label.isSensitive && !canSeeSensitive(ctx.assess)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Anda tidak boleh memakai label sensitif.',
          });
        }
        await assertApplicationAccess(tx, ctx.assess, app.id);

        const noteText = input.note?.trim() ?? '';
        const note = noteText ? noteText : null;
        const [existing] = await tx
          .select({ id: applicationFlag.id })
          .from(applicationFlag)
          .where(
            and(
              eq(applicationFlag.applicationId, input.applicationId),
              eq(applicationFlag.labelId, input.labelId),
            ),
          )
          .for('update');
        if (existing) {
          await tx
            .update(applicationFlag)
            .set({ note, appliedBy: ctx.session.user.id })
            .where(eq(applicationFlag.id, existing.id));
        } else {
          await tx.insert(applicationFlag).values({
            applicationId: input.applicationId,
            labelId: input.labelId,
            appliedBy: ctx.session.user.id,
            note,
          });
        }
        await logAction(tx, {
          recruitmentId: input.recruitmentId,
          actorId: ctx.session.user.id,
          action: 'label_diterapkan',
          entityType: 'application_flag',
          entityId: input.applicationId,
          detail: { labelId: input.labelId },
        });
        return { success: true };
      });
    }),

  flagRemove: oprecAssessProcedure
    .input(FlagRemoveInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const app = await assertApplicationOfRecruitment(
          tx,
          input.recruitmentId,
          input.applicationId,
        );
        const [label] = await tx
          .select()
          .from(flagLabel)
          .where(
            and(
              eq(flagLabel.id, input.labelId),
              eq(flagLabel.recruitmentId, input.recruitmentId),
            ),
          )
          .for('update');
        if (!label) notFound('Label tidak ditemukan.');
        if (label.isSensitive && !canSeeSensitive(ctx.assess)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Anda tidak boleh memakai label sensitif.',
          });
        }
        await assertApplicationAccess(tx, ctx.assess, app.id);

        const deleted = await tx
          .delete(applicationFlag)
          .where(
            and(
              eq(applicationFlag.applicationId, input.applicationId),
              eq(applicationFlag.labelId, input.labelId),
            ),
          )
          .returning({ id: applicationFlag.id });
        if (deleted.length > 0) {
          await logAction(tx, {
            recruitmentId: input.recruitmentId,
            actorId: ctx.session.user.id,
            action: 'label_dilepas',
            entityType: 'application_flag',
            entityId: input.applicationId,
            detail: { labelId: input.labelId },
          });
        }
        return { success: true };
      });
    }),

  applicationFlags: oprecAssessProcedure
    .input(ApplicationFlagsInput)
    .query(async ({ ctx, input }) => {
      const app = await assertApplicationOfRecruitment(
        ctx.db,
        input.recruitmentId,
        input.applicationId,
      );
      await assertApplicationAccess(ctx.db, ctx.assess, app.id);
      return ctx.db
        .select({
          labelId: applicationFlag.labelId,
          name: flagLabel.name,
          color: flagLabel.color,
          isSensitive: flagLabel.isSensitive,
          note: applicationFlag.note,
          appliedBy: users.name,
          created_at: applicationFlag.created_at,
        })
        .from(applicationFlag)
        .innerJoin(flagLabel, eq(flagLabel.id, applicationFlag.labelId))
        .innerJoin(users, eq(users.id, applicationFlag.appliedBy))
        .where(
          and(
            eq(applicationFlag.applicationId, input.applicationId),
            canSeeSensitive(ctx.assess)
              ? undefined
              : eq(flagLabel.isSensitive, false),
          ),
        )
        .orderBy(asc(applicationFlag.created_at));
    }),
};
