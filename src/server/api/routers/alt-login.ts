import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  adminPermissionProcedure,
  createTRPCRouter,
  publicProcedure,
} from '~/server/api/trpc';
import { isAllowedFileHost } from '~/server/api/types/form.constants';
import {
  AltClaimError,
  approveAltClaim,
  createAltClaim,
} from '~/server/alt-login';
import {
  adminAudit,
  altLoginClaim,
  mahasiswa,
  users,
} from '~/server/db/schema';

const KTM_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const KTM_MAX_BYTES = 10 * 1024 * 1024;

const KtmSchema = z.object({
  itemId: z.string().min(1).max(255),
  driveId: z.string().max(255),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(KTM_MAX_BYTES),
  mime: z.string().refine((m) => KTM_MIMES.includes(m), 'Format KTM tidak didukung.'),
  url: z
    .string()
    .url()
    .refine(isAllowedFileHost, 'Tautan berkas tidak valid.'),
  scope: z.enum(['anyone', 'organization']),
  provider: z.enum(['uploadthing', 'google-drive', 'onedrive']).optional(),
});

function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded ?? headers.get('x-real-ip'))?.slice(0, 64) ?? null;
}

export const altLoginRouter = createTRPCRouter({
  /**
   * Pengajuan akses sementara. Email hanya label kontak (tidak diverifikasi);
   * sesi diikat ke `secret` yang dikembalikan sekali ini dan dipakai klien
   * untuk masuk lewat provider `alt-claim`.
   */
  claim: publicProcedure
    .meta({ access: 'public', alt: 'any' })
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email().max(255),
        nim: z.string().trim(),
        ktm: KtmSchema,
        /** Pernyataan bahwa NIM dan KTM ini milik pengaju sendiri. */
        declaration: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { claim, secret } = await createAltClaim(
          {
            contactEmail: input.email,
            nim: input.nim,
            ktm: input.ktm,
            ip: clientIp(ctx.headers),
            ownClaimId: ctx.session?.user.altClaimId ?? null,
          },
          ctx.db,
        );
        return {
          claimId: claim.id,
          secret,
          expiresAt: claim.expiresAt,
          pending: claim.disputed,
        };
      } catch (error) {
        if (error instanceof AltClaimError) {
          throw new TRPCError({
            code: error.code.startsWith('rate_')
              ? 'TOO_MANY_REQUESTS'
              : 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  adminPendingCount: adminPermissionProcedure('accounts.read').query(
    async ({ ctx }) => {
      const [row] = await ctx.db
        .select({ n: count() })
        .from(altLoginClaim)
        .where(
          and(
            eq(altLoginClaim.disputed, true),
            isNull(altLoginClaim.approvedAt),
            isNull(altLoginClaim.revokedAt),
            gt(altLoginClaim.expiresAt, new Date()),
          ),
        );
      return { count: row?.n ?? 0 };
    },
  ),

  adminList: adminPermissionProcedure('accounts.read')
    .input(
      z.object({
        onlyActive: z.boolean().default(false),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const rows = await ctx.db
        .select({
          id: altLoginClaim.id,
          nim: altLoginClaim.nim,
          contactEmail: altLoginClaim.contactEmail,
          ktm: altLoginClaim.ktm,
          disputed: altLoginClaim.disputed,
          approvedAt: altLoginClaim.approvedAt,
          expiresAt: altLoginClaim.expiresAt,
          revokedAt: altLoginClaim.revokedAt,
          revokedReason: altLoginClaim.revokedReason,
          createdAt: altLoginClaim.created_at,
          userId: altLoginClaim.userId,
          userName: users.name,
          userEmail: users.email,
          jurusan: mahasiswa.jurusan,
        })
        .from(altLoginClaim)
        .innerJoin(users, eq(users.id, altLoginClaim.userId))
        .leftJoin(mahasiswa, eq(mahasiswa.userId, altLoginClaim.userId))
        .where(
          input.onlyActive
            ? and(
                isNull(altLoginClaim.revokedAt),
                gt(altLoginClaim.expiresAt, now),
              )
            : undefined,
        )
        .orderBy(desc(altLoginClaim.created_at))
        .limit(input.limit);

      return rows.map((row) => ({
        ...row,
        ktmUrl:
          row.ktm && typeof row.ktm.url === 'string' ? row.ktm.url : null,
        ktm: undefined,
        status: row.revokedAt
          ? ('dicabut' as const)
          : row.expiresAt <= now
            ? ('berakhir' as const)
            : row.disputed && !row.approvedAt
              ? ('menunggu' as const)
              : ('aktif' as const),
      }));
    }),

  adminApprove: adminPermissionProcedure('accounts.write')
    .input(z.object({ claimId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const claim = await approveAltClaim(
        input.claimId,
        ctx.session.user.id,
        ctx.db,
      );
      if (!claim) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pengajuan ini sudah tidak menunggu persetujuan.',
        });
      }
      await ctx.db.insert(adminAudit).values({
        actorId: ctx.session.user.id,
        action: 'alt_login_approve',
        entityType: 'user',
        entityId: claim.userId,
        summary: `Menyetujui akses alternatif NIM ${claim.nim} (${claim.contactEmail})`,
        metadata: { claimId: claim.id },
      });
      return { success: true };
    }),

  adminRevoke: adminPermissionProcedure('accounts.write')
    .input(z.object({ claimId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [claim] = await ctx.db
        .select()
        .from(altLoginClaim)
        .where(eq(altLoginClaim.id, input.claimId))
        .limit(1);
      if (!claim) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Klaim tidak ditemukan.' });
      }
      if (claim.revokedAt) return { success: true };
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(altLoginClaim)
          .set({
            revokedAt: new Date(),
            revokedReason: 'admin',
            revokedBy: ctx.session.user.id,
          })
          .where(eq(altLoginClaim.id, claim.id));
        await tx.insert(adminAudit).values({
          actorId: ctx.session.user.id,
          action: 'alt_login_revoke',
          entityType: 'user',
          entityId: claim.userId,
          summary: `Mencabut akses alternatif NIM ${claim.nim} (${claim.contactEmail})`,
          metadata: { claimId: claim.id },
        });
      });
      return { success: true };
    }),
});
