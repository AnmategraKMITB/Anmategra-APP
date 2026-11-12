import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { adminPermission } from '~/server/db/schema';

/** Superadmin (role `admin`) atau operator dengan izin `admin_permission` aktif. */
export async function isSuperadminOrOperator(user: {
  id: string;
  role: string;
}): Promise<boolean> {
  if (user.role === 'admin') return true;
  const row = await db.query.adminPermission.findFirst({
    where: and(
      eq(adminPermission.userId, user.id),
      isNull(adminPermission.revokedAt),
      or(
        isNull(adminPermission.expiresAt),
        sql`${adminPermission.expiresAt} > now()`,
      ),
    ),
    columns: { permissions: true },
  });
  return (row?.permissions.length ?? 0) > 0;
}
