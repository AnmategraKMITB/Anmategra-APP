import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AdminNav } from '~/app/_components/admin/admin-nav';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { adminPermission } from '~/server/db/schema';

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerAuthSession();
  if (!session) redirect('/authentication?callbackUrl=/admin');

  let permissions: string[] = [];
  if (session.user.role === 'admin') {
    permissions = ['*'];
  } else {
    const row = await db.query.adminPermission.findFirst({
      where: and(
        eq(adminPermission.userId, session.user.id),
        isNull(adminPermission.revokedAt),
        or(
          isNull(adminPermission.expiresAt),
          sql`${adminPermission.expiresAt} > now()`,
        ),
      ),
      columns: { permissions: true },
    });
    permissions = row?.permissions ?? [];
  }

  if (permissions.length === 0) redirect(`/${session.user.role}`);

  return (
    <div className="w-full px-4 py-6 sm:px-8">
      <AdminNav email={session.user.email ?? ''} permissions={permissions} />
      {children}
    </div>
  );
};

export default AdminLayout;
