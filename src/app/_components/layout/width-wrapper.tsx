'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from './navbar';
import { type Session } from 'next-auth';

export function WidthWrapper({
  children,
  session,
  landingPath,
}: {
  children: ReactNode;
  session: Session | null;
  landingPath: string;
}) {
  const pathname = usePathname();
  const isLandingPage = pathname === landingPath;
  // Editor organogram adalah ruang kerja lebar penuh (tiga panel), bukan halaman berkolom.
  const isWorkspace = /\/kegiatan\/[^/]+\/organogram\/?$/.test(pathname);

  if (isWorkspace) {
    return (
      <div className="flex flex-col items-center">
        <div className="sticky top-0 z-20 w-full shadow-sm">
          <Navbar session={session} />
        </div>
        <div className="w-full pt-16 sm:pt-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="sticky top-0 z-20 w-full shadow-sm">
        <Navbar session={session} />
      </div>
      <div className={`w-full ${isLandingPage ? '' : 'max-w-7xl pt-16 sm:pt-0 px-6 lg:px-12'} mb-10`}>
        {children}
      </div>
    </div>
  );
}