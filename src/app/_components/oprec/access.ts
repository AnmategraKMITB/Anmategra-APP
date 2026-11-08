import { eq } from 'drizzle-orm';
import { canManageEvent } from '~/server/api/access';
import { resolveAssessAccess } from '~/server/api/routers/oprec/assess-access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { recruitment } from '~/server/db/schema';

/** Apakah pengguna ini boleh mengurus oprec di kegiatan/periode `eventId`. */
export async function canManageEventOprec(eventId: string) {
  const session = await getServerAuthSession();
  if (!session) return false;
  const { id: userId, role, lembagaId } = session.user;
  return !!(await canManageEvent(
    db,
    userId,
    role,
    lembagaId,
    eventId,
    'oprec',
  ));
}

/**
 * Oprec yang boleh dikelola pengguna saat ini, atau `null` (halaman memanggil
 * `notFound()`). Aturannya sama dengan `oprecScopedProcedure`.
 */
export async function loadManagedOprec(recruitmentId: string) {
  const [row] = await db
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  if (!row) return null;
  return (await canManageEventOprec(row.periodId)) ? row : null;
}

/**
 * Oprec yang boleh dinilai pengguna saat ini (admin, Kadiv, atau penilai),
 * atau `null`. Aturannya sama dengan `oprecAssessProcedure`.
 */
export async function loadAssessableOprec(recruitmentId: string) {
  const session = await getServerAuthSession();
  if (!session) return null;
  const [row] = await db
    .select()
    .from(recruitment)
    .where(eq(recruitment.id, recruitmentId));
  if (!row) return null;
  const access = await resolveAssessAccess(
    db,
    {
      id: session.user.id,
      role: session.user.role,
      lembagaId: session.user.lembagaId,
    },
    row,
  );
  return access ? { recruitment: row, access } : null;
}
