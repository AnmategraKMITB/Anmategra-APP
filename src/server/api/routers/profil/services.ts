import { TRPCError } from '@trpc/server';
import type { inferAsyncReturnType } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { type createTRPCContext } from '~/server/api/trpc';
import { events, profilKegiatan, profilLembaga } from '~/server/db/schema';

type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;

/** Profil harus milik `lembagaId` (Scope yang sudah diotorisasi). */
export async function validateLembagaProfileOwnership(
  ctx: TRPCContext,
  profileId: string,
  lembagaId: string,
) {
  const lembaga = await ctx.db.query.profilLembaga.findFirst({
    where: eq(profilLembaga.id, profileId),
    columns: { lembagaId: true },
  });

  if (lembaga?.lembagaId !== lembagaId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action',
    });
  }
}

/** Kegiatan harus milik `lembagaId` (Scope yang sudah diotorisasi). */
export async function validateKegiatanOwnership(
  ctx: TRPCContext,
  kegiatanId: string,
  lembagaId: string,
) {
  const eventOwner = await ctx.db.query.events.findFirst({
    where: eq(events.id, kegiatanId),
    columns: { org_id: true },
  });

  if (lembagaId !== eventOwner?.org_id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action',
    });
  }
}

export async function validateKegiatanProfileOwnership(
  ctx: TRPCContext,
  profileId: string,
  lembagaId: string,
) {
  const eventOwner = await ctx.db.query.profilKegiatan.findFirst({
    where: eq(profilKegiatan.id, profileId),
    with: {
      event: {
        columns: { org_id: true },
      },
    },
  });

  const event = eventOwner?.event as { org_id: string } | null | undefined;
  if (lembagaId !== event?.org_id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not authorized to perform this action',
    });
  }
}
