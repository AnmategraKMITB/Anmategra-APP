import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  type AudienceApplicant,
  tallyNotificationAudience,
} from '~/lib/oprec/notification-audience';
import { effectiveStatus } from '~/lib/oprec/scoring';
import { oprecScopedProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  choiceStatusOverride,
  form,
  notifications,
  organizationUnit,
  placementDecision,
  recruitmentDivision,
} from '~/server/db/schema';

import {
  NotificationAudienceInputSchema,
  NotificationAudienceOutputSchema,
  type NotificationScope,
  SendApplicantNotificationInputSchema,
  SendApplicantNotificationOutputSchema,
} from '../../types/oprec.type';
import { ROOT_DEPTH } from '../organization/tree';
import { logAction } from './log';
import { MANUAL_NOTIFICATION_KIND } from './notification-kind';
import { type Queryable } from './services';

/** Satu INSERT per potongan agar ratusan penerima tidak membentuk satu query raksasa. */
const CHUNK = 500;

/** Pendaftar terkirim dan closerec, beserta pilihan dan keputusannya. */
async function loadAudienceApplicants(
  db: Queryable,
  recruitmentId: string,
): Promise<AudienceApplicant[]> {
  const rows = await db
    .select({
      applicationId: application.id,
      userId: application.userId,
      choiceId: applicationChoice.id,
      divisionId: applicationChoice.divisionId,
      rank: applicationChoice.rank,
      computedStatus: applicationChoice.computedStatus,
      overrideStatus: choiceStatusOverride.status,
      decision: placementDecision.decision,
    })
    .from(application)
    .leftJoin(
      applicationChoice,
      eq(applicationChoice.applicationId, application.id),
    )
    .leftJoin(
      choiceStatusOverride,
      and(
        eq(choiceStatusOverride.choiceId, applicationChoice.id),
        isNull(choiceStatusOverride.clearedAt),
      ),
    )
    .leftJoin(
      placementDecision,
      eq(placementDecision.choiceId, applicationChoice.id),
    )
    .where(
      and(
        eq(application.recruitmentId, recruitmentId),
        or(
          isNotNull(application.submittedAt),
          eq(application.source, 'closerec'),
        ),
      ),
    );

  const byApplication = new Map<string, AudienceApplicant>();
  for (const row of rows) {
    let entry = byApplication.get(row.applicationId);
    if (!entry) {
      entry = {
        applicationId: row.applicationId,
        userId: row.userId,
        choices: [],
      };
      byApplication.set(row.applicationId, entry);
    }
    if (!row.choiceId || !row.divisionId) continue;
    entry.choices.push({
      id: row.choiceId,
      divisionId: row.divisionId,
      rank: row.rank,
      status: effectiveStatus(
        row.computedStatus,
        row.overrideStatus === null
          ? null
          : {
              status: row.overrideStatus,
              computedStatusAtOverride: null,
              scoreAtOverride: null,
            },
      ),
      decision: row.decision,
    });
  }
  return [...byApplication.values()];
}

/** Divisi oprec beserta bidang induknya, untuk pilihan lingkup di dialog. */
async function loadAudienceDivisions(db: Queryable, recruitmentId: string) {
  const parent = alias(organizationUnit, 'notification_parent_unit');
  return db
    .select({
      id: recruitmentDivision.id,
      label: organizationUnit.name,
      // Divisi yang langsung berada di bawah akar tidak punya bidang.
      groupLabel: sql<string | null>`
        case when ${parent.level} = ${ROOT_DEPTH} then null else ${parent.name} end
      `,
    })
    .from(recruitmentDivision)
    .innerJoin(
      organizationUnit,
      eq(organizationUnit.id, recruitmentDivision.unitId),
    )
    .leftJoin(parent, eq(parent.id, organizationUnit.parent_id))
    .where(eq(recruitmentDivision.recruitmentId, recruitmentId))
    .orderBy(asc(recruitmentDivision.sortOrder), asc(organizationUnit.name));
}

type AudienceDivision = Awaited<
  ReturnType<typeof loadAudienceDivisions>
>[number];

/** Lingkup bidang/divisi → daftar id divisi; undefined = seluruh oprec. */
function scopeDivisionIds(
  divisions: AudienceDivision[],
  scope: NotificationScope,
): string[] | undefined {
  if (scope.kind === 'all') return undefined;
  if (scope.kind === 'division') {
    if (!divisions.some((division) => division.id === scope.divisionId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Divisi tidak ditemukan pada oprec ini.',
      });
    }
    return [scope.divisionId];
  }
  const ids = divisions
    .filter((division) => division.groupLabel === scope.groupLabel)
    .map((division) => division.id);
  if (ids.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Bidang tidak ditemukan pada oprec ini.',
    });
  }
  return ids;
}

export const notificationProcedures = {
  /** Jumlah penerima per audiens untuk lingkup divisi yang sedang dipilih. */
  notificationAudience: oprecScopedProcedure
    .input(NotificationAudienceInputSchema)
    .output(NotificationAudienceOutputSchema)
    .query(async ({ ctx, input }) => {
      const [applicants, divisions] = await Promise.all([
        loadAudienceApplicants(ctx.db, ctx.recruitment.id),
        loadAudienceDivisions(ctx.db, ctx.recruitment.id),
      ]);
      const divisionIds = scopeDivisionIds(divisions, input.scope);
      const tally = tallyNotificationAudience(applicants, {
        audience: 'all',
        divisionIds,
        staged: ctx.recruitment.stagedPlacement,
      });
      return {
        counts: {
          all: tally.all,
          accepted: tally.accepted,
          rejected: tally.rejected,
          undecided: tally.undecided,
        },
        divisions,
      };
    }),

  /**
   * Kirim satu pesan bebas ke Inbox pendaftar oprec. Penerima ditentukan ulang
   * di server dari audiens dan lingkup divisi, bukan dari daftar id di klien.
   */
  sendApplicantNotification: oprecScopedProcedure
    .input(SendApplicantNotificationInputSchema)
    .output(SendApplicantNotificationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const rec = ctx.recruitment;
      const [applicants, divisions, [formRow]] = await Promise.all([
        loadAudienceApplicants(ctx.db, rec.id),
        loadAudienceDivisions(ctx.db, rec.id),
        ctx.db
          .select({ id: form.id, slug: form.slug })
          .from(form)
          .where(eq(form.id, rec.formId)),
      ]);
      const divisionIds = scopeDivisionIds(divisions, input.scope);
      const tally = tallyNotificationAudience(applicants, {
        audience: input.audience,
        divisionIds,
        staged: rec.stagedPlacement,
      });
      if (tally.recipients.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Tidak ada pendaftar yang cocok dengan audiens dan divisi yang dipilih.',
        });
      }

      const links = [
        {
          label: 'Buka halaman pendaftaran',
          href: `/forms/${formRow?.slug ?? rec.formId}`,
        },
      ];

      await ctx.db.transaction(async (tx) => {
        for (let i = 0; i < tally.recipients.length; i += CHUNK) {
          await tx.insert(notifications).values(
            tally.recipients.slice(i, i + CHUNK).map((userId) => ({
              id: crypto.randomUUID(),
              user_id: userId,
              title: input.title,
              content: input.content,
              type: 'System' as const,
              recruitmentId: rec.id,
              kind: MANUAL_NOTIFICATION_KIND,
              links,
            })),
          );
        }
        await logAction(tx, {
          recruitmentId: rec.id,
          actorId: ctx.session.user.id,
          action: 'notify_applicants',
          entityType: 'notification',
          detail: {
            audience: input.audience,
            scope: input.scope,
            sent: tally.recipients.length,
            title: input.title,
          },
        });
      });

      return { sent: tally.recipients.length };
    }),
};
