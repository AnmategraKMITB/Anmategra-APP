import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { AdminNav } from '~/app/_components/admin/admin-nav';
import { getServerAuthSession } from '~/server/auth';

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerAuthSession();
  if (!session) redirect('/authentication?callbackUrl=/admin');
  if (session.user.role !== 'admin') redirect(`/${session.user.role}`);
  return (
    <div className="w-full px-4 py-6 sm:px-8">
      <AdminNav email={session.user.email ?? ''} />
      {children}
    </div>
  );
};

export default AdminLayout;
