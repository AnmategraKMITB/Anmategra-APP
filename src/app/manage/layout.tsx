import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { getServerAuthSession } from '~/server/auth';
import { WidthWrapper } from '../_components/layout/width-wrapper';

export const metadata = {
  title: 'Kelola',
  robots: { index: false, follow: false },
};

/**
 * Alat pengelola lembaga dan kegiatan. Terbuka bagi pengguna yang login; akses
 * ke tiap halaman diperiksa di halamannya lewat canManageLembaga/canManageEvent.
 */
const ManageLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerAuthSession();
  if (!session) redirect('/authentication');
  return (
    <WidthWrapper session={session} landingPath="/manage">
      {children}
    </WidthWrapper>
  );
};

export default ManageLayout;
