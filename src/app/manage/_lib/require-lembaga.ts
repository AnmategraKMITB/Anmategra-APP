import { notFound } from 'next/navigation';
import { canManageLembaga } from '~/server/api/access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';

/** Guard halaman /manage/[lembagaId]/...: 404 bila bukan pengelola. */
export async function requireManagedLembaga(lembagaId: string) {
  const session = await getServerAuthSession();
  if (!session) notFound();
  const { user } = session;
  const access = await canManageLembaga(
    db,
    user.id,
    user.role,
    user.lembagaId,
    lembagaId,
  );
  if (!access) notFound();
  return { session, access };
}
