// import { type Metadata } from 'next';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { getServerAuthSession } from '~/server/auth';
import { WidthWrapper } from '../_components/layout/width-wrapper';

import Navbar from '../_components/layout/navbar';

// Metadata
// export const metadata: Metadata = {
//   title: 'Lembaga',
//   description: 'Anmategra by KM ITB',
//   icons: [{ rel: 'icon', url: '/favicon.ico' }],
// };

const LembagaLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getServerAuthSession();
  // Lapisan kedua setelah middleware: area ini hanya untuk akun lembaga.
  if (!session) redirect('/authentication');
  if (session.user.role !== 'lembaga') redirect(`/${session.user.role}`);
  return (
    // <div className="flex flex-col items-center">
    //   <div className="sticky top-0 z-20 w-full">
    //     <Navbar session={session} />
    //   </div>
    //   <div className="w-full max-w-7xl flex-1 pt-16 sm:pt-0 px-6 lg:px-12 mb-10">
    //     {children}
    //   </div>
    // </div>
    <WidthWrapper session={session} landingPath="/lembaga">
      {children}
    </WidthWrapper>
  );
};

export default LembagaLayout;
