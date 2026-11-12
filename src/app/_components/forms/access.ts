import { eq } from 'drizzle-orm';
import { canManageEvent, canManageLembaga } from '~/server/api/access';
import { ownerOf } from '~/server/api/routers/form/services';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { form } from '~/server/db/schema';

/**
 * Form yang boleh dikelola pengguna saat ini, atau `null` (halaman memanggil
 * `notFound()`): tidak login, form tidak ada, atau bukan pemilik/admin.
 * Aturannya sama dengan `formScopedProcedure`.
 */
export async function loadManagedForm(formId: string) {
  const session = await getServerAuthSession();
  if (!session) return null;

  const [row] = await db.select().from(form).where(eq(form.id, formId));
  if (!row) return null;

  const { id: userId, role, lembagaId } = session.user;
  const access = row.lembagaId
    ? await canManageLembaga(
        db,
        userId,
        role,
        lembagaId,
        row.lembagaId,
        'forms',
      )
    : row.eventId
      ? await canManageEvent(db, userId, role, lembagaId, row.eventId, 'forms')
      : null;
  if (!access) return null;

  return { form: row, owner: await ownerOf(db, row) };
}

/** Apakah pengguna ini boleh mengelola form kegiatan `eventId`. */
export async function canManageEventForms(eventId: string) {
  const session = await getServerAuthSession();
  if (!session) return false;
  const { id: userId, role, lembagaId } = session.user;
  return !!(await canManageEvent(
    db,
    userId,
    role,
    lembagaId,
    eventId,
    'forms',
  ));
}
