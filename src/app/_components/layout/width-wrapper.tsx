'use client';

import { type Session } from 'next-auth';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef } from 'react';
import { isFormBuilderWorkspace, isOrganogramWorkspace } from '~/lib/workspace';

import Navbar from './navbar';

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
  const isWorkspace =
    isOrganogramWorkspace(pathname) || isFormBuilderWorkspace(pathname);
  const navRef = useRef<HTMLDivElement>(null);

  // Tinggi navbar sebagai variabel CSS, supaya bilah lengket di halaman (mis.
  // kepala builder form) bisa menempel tepat di bawahnya. Di layar kecil navbar
  // berupa bilah `fixed` di dalam pembungkus ini, jadi yang diukur adalah yang
  // tertinggi dari keduanya.
  useEffect(() => {
    const wrapper = navRef.current;
    if (!wrapper) return;
    const update = () => {
      const fixed = wrapper.querySelector<HTMLElement>('.fixed');
      const height = Math.max(wrapper.offsetHeight, fixed?.offsetHeight ?? 0);
      document.documentElement.style.setProperty(
        '--app-navbar-h',
        `${height}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    const fixed = wrapper.querySelector<HTMLElement>('.fixed');
    if (fixed) observer.observe(fixed);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [isWorkspace]);

  if (isWorkspace) {
    return (
      <div className="flex flex-col items-center">
        <div ref={navRef} className="sticky top-0 z-20 w-full shadow-sm">
          <Navbar session={session} />
        </div>
        <div className="w-full pt-16 sm:pt-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div ref={navRef} className="sticky top-0 z-20 w-full shadow-sm">
        <Navbar session={session} />
      </div>
      <div
        className={`w-full ${isLandingPage ? '' : 'max-w-7xl pt-16 sm:pt-0 px-6 lg:px-12'} mb-10`}
      >
        {children}
      </div>
    </div>
  );
}
