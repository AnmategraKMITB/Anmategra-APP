/**
 * Tawaran penempatan (metode prioritas). Setelah penempatan otomatis
 * diterapkan, admin bisa membuka tawaran sebuah divisi yang masih kurang
 * orang bagi pendaftar yang belum diterima di mana pun. Pendaftar menyatakan
 * bersedia dari halaman pendaftarannya; ia lalu ditandai bersedia dipindahkan
 * dan ditambahkan di akhir urutan prioritas divisi itu. Penempatannya baru
 * berubah saat admin menerapkan penempatan otomatis lagi, jadi kuota dan
 * urutan divisi tetap berlaku.
 *
 * Urutan kunci mengikuti priority.ts: baris oprec (FOR SHARE), baris divisi
 * (FOR UPDATE), lalu baris pendaftar.
 */
import { TRPCError } from '@trpc/server';
import {
  and,
  asc,
  count,
  eq,
  gt,
  isNotNull,
  isNull,
  max,
  ne,
  notExists,
} from 'drizzle-orm';
import { z } from 'zod';
import { resultsPublished } from '~/server/api/oprec-release';
import { oprecAssessProcedure, protectedProcedure } from '~/server/api/trpc';
import {
  application,
  applicationChoice,
  divisionPriority,
  notifications,
  organizationUnit,
  placementDecision,
  recruitment,
  recruitmentDivision,
} from '~/server/db/schema';

import { type Tx } from '../form/services';
import { type AssessAccess } from './assess-access';
import { logAction } from './log';
import { loadPlacementDivisions } from './placement';
import { lockDivision } from './priority';
import { type Queryable, conflict, notFound } from './services';

const id = z.string().min(1).max(255);
const OK = { success: true } as const;
const CHUNK = 500;
/** Batas terjauh batas waktu tawaran. */
const MAX_OFFER_DAYS = 30;

export const OFFER_NOTIFICATION_KIND = 'tawaran_oprec';

type Recruitment = typeof recruitment.$inferSelect;

function assertAdmin(access: AssessAccess) {
  if (!access.isAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Hanya admin oprec yang boleh melakukan tindakan ini.',
    });
  }
}

/** Alasan tawaran tidak bisa dipakai pada oprec ini; null = bisa. */
export function offerProblem(
  rec: Pick<
    Recruitment,
    'placementMethod' | 'placementState' | 'allowRedirect'
  >,
): string | null {
  if (rec.placementMethod !== 'prioritas') {
    return 'Tawaran hanya tersedia pada metode penempatan prioritas.';
  }
  if (rec.placementState !== 'berjalan') {
    return 'Tawaran hanya bisa dipakai selama penempatan berjalan.';
  }
  if (!rec.allowRedirect) {
    return 'Oprec ini tidak mengizinkan pendaftar dipindahkan ke divisi di luar pilihannya.';
  }
  return null;
}

/**
 * Pendaftar lewat formulir yang sudah mengirim, belum diterima di divisi mana
 * pun (termasuk closerec), dan belum menerima tawaran.
 */
function unplacedWhere(db: Queryable, recruitmentId: string) {
  return and(
    eq(application.recruitmentId, recruitmentId),
    eq(application.source, 'form'),
    isNotNull(application.submittedAt),
    isNull(application.offerAcceptedAt),
    notExists(
      db
        .select({ one: applicationChoice.id })
        .from(applicationChoice)
        .innerJoin(
          placementDecision,
          eq(placementDecision.choiceId, applicationChoice.id),
        )
        .where(
          and(
            eq(applicationChoice.applicationId, application.id),
            eq(placementDecision.decision, 'terima'),
          ),
        ),
    ),
  );
}

async function isAccepted(db: Queryable, applicationId: string) {
  const [row] = await db
    .select({ one: applicationChoice.id })
    .from(applicationChoice)
    .innerJoin(
      placementDecision,
      eq(placementDecision.choiceId, applicationChoice.id),
    )
    .where(
      and(
        eq(applicationChoice.applicationId, applicationId),
        eq(placementDecision.decision, 'terima'),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Pemberitahuan Inbox untuk pendaftar yang belum diterima; satu per oprec. */
async function notifyUnplaced(db: Tx, rec: Recruitment) {
  const rows = await db
    .select({ userId: application.userId })
    .from(application)
    .where(unplacedWhere(db, rec.id));
  const title = `Tawaran tempat di oprec ${rec.name}`;
  const content =
    'Kamu belum mendapat tempat di pilihanmu. Panitia membuka tawaran tempat untukmu. Buka halaman pendaftaranmu untuk melihatnya sebelum batas waktu.';
  const links = [
    { label: 'Buka halaman pendaftaran', href: `/forms/${rec.formId}` },
  ];
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(notifications)
      .values(
        rows.slice(i, i + CHUNK).map((row) => ({
          id: crypto.randomUUID(),
          user_id: row.userId,
          title,
          content,
          type: 'System' as const,
          recruitmentId: rec.id,
          kind: OFFER_NOTIFICATION_KIND,
          links,
        })),
      )
      .onConflictDoNothing();
  }
  return rows.length;
}

export const offerProcedures = {
  /** Ringkasan tawaran untuk admin: pendaftar tanpa divisi dan tawaran per divisi. */
  offerOverview: oprecAssessProcedure
    .input(z.object({ recruitmentId: id }))
    .query(async ({ ctx }) => {
      assertAdmin(ctx.assess);
      const rec = ctx.recruitment;
      const [divisions, offers, [unplaced], acceptedOffers, filled] =
        await Promise.all([
          loadPlacementDivisions(ctx.db, rec.id),
          ctx.db
            .select({
              id: recruitmentDivision.id,
              closesAt: recruitmentDivision.offerClosesAt,
            })
            .from(recruitmentDivision)
            .where(eq(recruitmentDivision.recruitmentId, rec.id)),
          ctx.db
            .select({ n: count() })
            .from(application)
            .where(unplacedWhere(ctx.db, rec.id)),
          ctx.db
            .select({ divisionId: application.offerDivisionId, n: count() })
            .from(application)
            .where(
              and(
                eq(application.recruitmentId, rec.id),
                isNotNull(application.offerAcceptedAt),
              ),
            )
            .groupBy(application.offerDivisionId),
          ctx.db
            .select({ divisionId: applicationChoice.divisionId, n: count() })
            .from(placementDecision)
            .innerJoin(
              applicationChoice,
              eq(applicationChoice.id, placementDecision.choiceId),
            )
            .innerJoin(
              application,
              eq(application.id, applicationChoice.applicationId),
            )
            .where(
              and(
                eq(application.recruitmentId, rec.id),
                eq(placementDecision.decision, 'terima'),
                ne(applicationChoice.origin, 'closerec'),
              ),
            )
            .groupBy(applicationChoice.divisionId),
        ]);
      const closesAt = new Map(offers.map((o) => [o.id, o.closesAt]));
      const acceptedBy = new Map(
        acceptedOffers.map((r) => [r.divisionId, r.n]),
      );
      const filledBy = new Map(filled.map((r) => [r.divisionId, r.n]));
      const now = Date.now();
      return {
        problem: offerProblem(rec),
        unplaced: unplaced?.n ?? 0,
        divisions: divisions.map((d) => {
          const closes = closesAt.get(d.id) ?? null;
          return {
            id: d.id,
            label: d.label,
            groupLabel: d.groupLabel,
            quota: d.quota,
            filled: filledBy.get(d.id) ?? 0,
            offerClosesAt: closes,
            offerOpen: closes !== null && closes.getTime() > now,
            offerAccepted: acceptedBy.get(d.id) ?? 0,
          };
        }),
      };
    }),

  /** Buka (atau perpanjang) tawaran sebuah divisi dan beri tahu pendaftar tanpa divisi. */
  offerOpen: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, divisionId: id, closesAt: z.date() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      const now = Date.now();
      if (input.closesAt.getTime() <= now) {
        conflict('Batas waktu tawaran harus di masa depan.');
      }
      if (input.closesAt.getTime() > now + MAX_OFFER_DAYS * 86_400_000) {
        conflict(`Batas waktu tawaran paling lama ${MAX_OFFER_DAYS} hari.`);
      }
      return ctx.db.transaction(async (tx) => {
        const { rec } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        const problem = offerProblem(rec);
        if (problem) conflict(problem);
        await tx
          .update(recruitmentDivision)
          .set({ offerClosesAt: input.closesAt })
          .where(eq(recruitmentDivision.id, input.divisionId));
        const notified = await notifyUnplaced(tx, rec);
        await logAction(tx, {
          recruitmentId: rec.id,
          actorId: ctx.session.user.id,
          action: 'tawaran_dibuka',
          entityType: 'division',
          entityId: input.divisionId,
          detail: { closesAt: input.closesAt.toISOString(), notified },
        });
        return { notified };
      });
    }),

  /** Tutup tawaran sekarang. Yang sudah bersedia tetap ada di urutan. */
  offerClose: oprecAssessProcedure
    .input(z.object({ recruitmentId: id, divisionId: id }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.assess);
      return ctx.db.transaction(async (tx) => {
        const { rec } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        const closed = await tx
          .update(recruitmentDivision)
          .set({ offerClosesAt: new Date() })
          .where(
            and(
              eq(recruitmentDivision.id, input.divisionId),
              gt(recruitmentDivision.offerClosesAt, new Date()),
            ),
          )
          .returning({ id: recruitmentDivision.id });
        if (closed.length > 0) {
          await logAction(tx, {
            recruitmentId: rec.id,
            actorId: ctx.session.user.id,
            action: 'tawaran_ditutup',
            entityType: 'division',
            entityId: input.divisionId,
          });
        }
        return OK;
      });
    }),

  /**
   * Tawaran untuk pendaftar sendiri: tawaran yang masih dibuka bila ia belum
   * diterima di mana pun, atau tawaran yang sudah ia terima.
   */
  myOffer: protectedProcedure
    .input(z.object({ recruitmentId: id }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ rec: recruitment, app: application })
        .from(application)
        .innerJoin(recruitment, eq(recruitment.id, application.recruitmentId))
        .where(
          and(
            eq(application.recruitmentId, input.recruitmentId),
            eq(application.userId, ctx.session.user.id),
          ),
        );
      if (row?.app.source !== 'form' || !row.app.submittedAt) return null;
      const { rec, app } = row;

      if (app.offerAcceptedAt) {
        // Setelah hasil tayang, kartu hasil yang berbicara.
        if (resultsPublished(rec)) return null;
        const [division] = app.offerDivisionId
          ? await ctx.db
              .select({ label: organizationUnit.name })
              .from(recruitmentDivision)
              .innerJoin(
                organizationUnit,
                eq(organizationUnit.id, recruitmentDivision.unitId),
              )
              .where(eq(recruitmentDivision.id, app.offerDivisionId))
          : [];
        return {
          accepted: {
            divisionLabel: division?.label ?? 'divisi tawaran',
            acceptedAt: app.offerAcceptedAt,
          },
          offers: [],
        };
      }
      if (offerProblem(rec) || (await isAccepted(ctx.db, app.id))) return null;

      const offers = await ctx.db
        .select({
          divisionId: recruitmentDivision.id,
          divisionLabel: organizationUnit.name,
          closesAt: recruitmentDivision.offerClosesAt,
        })
        .from(recruitmentDivision)
        .innerJoin(
          organizationUnit,
          eq(organizationUnit.id, recruitmentDivision.unitId),
        )
        .where(
          and(
            eq(recruitmentDivision.recruitmentId, rec.id),
            gt(recruitmentDivision.offerClosesAt, new Date()),
          ),
        )
        .orderBy(asc(recruitmentDivision.sortOrder));
      if (offers.length === 0) return null;
      return {
        accepted: null,
        offers: offers.map((o) => ({ ...o, closesAt: o.closesAt! })),
      };
    }),

  /**
   * Pendaftar menyatakan bersedia ditempatkan di divisi tawaran: ditandai
   * bersedia dipindahkan dan ditambahkan di akhir urutan prioritas divisi itu.
   * Satu pendaftar hanya bisa menerima satu tawaran.
   */
  offerAccept: protectedProcedure
    .input(z.object({ recruitmentId: id, divisionId: id }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      return ctx.db.transaction(async (tx) => {
        const { rec } = await lockDivision(
          tx,
          input.recruitmentId,
          input.divisionId,
        );
        const [division] = await tx
          .select({ closesAt: recruitmentDivision.offerClosesAt })
          .from(recruitmentDivision)
          .where(eq(recruitmentDivision.id, input.divisionId));
        const [app] = await tx
          .select()
          .from(application)
          .where(
            and(
              eq(application.recruitmentId, rec.id),
              eq(application.userId, userId),
            ),
          )
          .for('update');
        if (app?.source !== 'form' || !app.submittedAt) {
          notFound('Kamu tidak mendaftar di oprec ini.');
        }
        if (app.offerAcceptedAt) {
          if (app.offerDivisionId === input.divisionId) return OK;
          conflict('Kamu sudah menerima tawaran divisi lain.');
        }
        if (
          offerProblem(rec) ||
          !division?.closesAt ||
          division.closesAt.getTime() <= Date.now()
        ) {
          conflict('Tawaran ini sudah ditutup.');
        }
        if (await isAccepted(tx, app.id)) {
          conflict('Kamu sudah diterima di oprec ini.');
        }

        const now = new Date();
        await tx
          .update(application)
          .set({
            willingToMove: true,
            offerDivisionId: input.divisionId,
            offerAcceptedAt: now,
          })
          .where(eq(application.id, app.id));

        // Urutan berikutnya di akhir daftar. Baris yang hanya berisi
        // keterangan diberi urutan; urutan yang sudah ada dibiarkan.
        const [existing] = await tx
          .select({ id: divisionPriority.id, rank: divisionPriority.rank })
          .from(divisionPriority)
          .where(
            and(
              eq(divisionPriority.divisionId, input.divisionId),
              eq(divisionPriority.applicationId, app.id),
            ),
          );
        let rank = existing?.rank ?? null;
        if (rank === null) {
          const [last] = await tx
            .select({ rank: max(divisionPriority.rank) })
            .from(divisionPriority)
            .where(eq(divisionPriority.divisionId, input.divisionId));
          rank = (last?.rank ?? 0) + 1;
          if (existing) {
            await tx
              .update(divisionPriority)
              .set({ rank, updatedBy: userId, updatedAt: now })
              .where(eq(divisionPriority.id, existing.id));
          } else {
            await tx.insert(divisionPriority).values({
              divisionId: input.divisionId,
              applicationId: app.id,
              rank,
              updatedBy: userId,
            });
          }
          const [d] = await tx
            .select({ version: recruitmentDivision.priorityVersion })
            .from(recruitmentDivision)
            .where(eq(recruitmentDivision.id, input.divisionId));
          await tx
            .update(recruitmentDivision)
            .set({ priorityVersion: (d?.version ?? 0) + 1 })
            .where(eq(recruitmentDivision.id, input.divisionId));
        }

        await logAction(tx, {
          recruitmentId: rec.id,
          actorId: userId,
          action: 'tawaran_diterima',
          entityType: 'application',
          entityId: app.id,
          detail: { divisionId: input.divisionId, rank },
        });
        return OK;
      });
    }),
};
