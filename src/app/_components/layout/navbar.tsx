'use client';

// Library Import
// Icon Import
import { Menu, Search } from 'lucide-react';
import { type Session } from 'next-auth';
// Next Auth Import
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LembagaPic from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import ProfilePic from 'public/images/placeholder/profile-pic.png';
import React, { useEffect, useState } from 'react';
// Components Import
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { MobileSearchOverlay } from './mobile-search-overlay';
import { SearchBar } from './search-bar';
import { Sidebar as Sidebars } from './sidebar';
// Assets Import
import LogoAnmategra from '/public/images/logo/anmategra-logo.png';

type SidebarProps = {
  session: Session | null;
  onClose?: () => void;
};

const Sidebar = Sidebars as (props: SidebarProps) => React.JSX.Element;

const Navbar = ({ session }: { session: Session | null }) => {
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();

  const lembagaInfo = api.lembaga.getInfo.useQuery(
    { lembagaId: session?.user.lembagaId ?? '' },
    { enabled: session?.user.role === 'lembaga' && !!session?.user.lembagaId },
  ).data;

  const user = api.users.getMahasiswaById.useQuery(
    { userId: session?.user.id ?? '' },
    { enabled: session?.user.role === 'mahasiswa' && !!session?.user.id },
  ).data?.mahasiswaData.user;

  useEffect(() => {
    if (
      session?.user.role === 'lembaga' &&
      !window.location.pathname.startsWith('/lembaga') &&
      // /manual is available to authenticated users at a shared URL;
      // don't bounce lembaga users away from it.
      !window.location.pathname.startsWith('/manual')
    ) {
      router.push('/lembaga');
    }
  }, [session, router]);

  return (
    <>
      {session && session.user.role === 'lembaga' ? (
        <>
          <div className="fixed left-0 right-0 top-0 z-30 w-full border-b border-neutral-50 bg-white sm:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <Link href="/lembaga" className="flex-shrink-0">
                  <Image
                    src={LogoAnmategra}
                    alt="Logo Anmategra"
                    width={40}
                    height={40}
                    priority
                  />
                </Link>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setIsSearchOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Cari"
                >
                  <Search className="h-5 w-5" />
                </Button>

                <Button
                  onClick={() => setIsSideBarOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Buka menu"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden w-full border-b border-neutral-50 bg-white sm:block">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3 lg:px-12 lg:py-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setIsSideBarOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Buka menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>

                <Link href="/lembaga" className="flex-shrink-0">
                  <Image
                    src={LogoAnmategra}
                    alt="Logo Anmategra"
                    width={48}
                    height={48}
                  />
                </Link>
              </div>

              <SearchBar
                role={session?.user.role}
                className="mx-4 max-w-2xl flex-1"
              />

              <nav className="flex flex-shrink-0 items-center">
                <Link
                  href={
                    lembagaInfo?.id
                      ? `/profile-lembaga/${lembagaInfo.id}`
                      : '/lembaga'
                  }
                >
                  <Image
                    src={lembagaInfo?.foto ?? LembagaPic}
                    alt="Profile User"
                    width={40}
                    height={40}
                    className="h-[40px] w-[40px] rounded-full object-cover"
                  />
                </Link>
              </nav>
            </div>
          </div>

          <MobileSearchOverlay
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            role={session?.user.role}
          />
        </>
      ) : (
        <>
          {/* Mobile Navbar */}
          <div className="fixed left-0 right-0 top-0 z-30 w-full border-b border-neutral-50 bg-white sm:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {session && (
                  <Button
                    onClick={() => setIsSideBarOpen(true)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}

                <Link
                  href={session ? '/mahasiswa' : '/'}
                  className="flex-shrink-0"
                >
                  <Image
                    src={LogoAnmategra}
                    alt="Logo Anmategra"
                    width={40}
                    height={40}
                    priority
                  />
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsSearchOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <Search className="h-5 w-5" />
                </Button>

                {session ? (
                  <Link href={`/profile-mahasiswa/${session.user.id}`}>
                    {user?.image ? (
                      <Image
                        src={user.image}
                        alt="Profile User"
                        width={36}
                        height={36}
                        className="h-[36px] w-[36px] rounded-full object-cover"
                      />
                    ) : (
                      <Image
                        src={ProfilePic}
                        alt="Default Profile"
                        width={36}
                        height={36}
                        className="h-[36px] w-[36px] rounded-full object-cover"
                      />
                    )}
                  </Link>
                ) : (
                  <Link href={'/authentication'}>
                    <Button className="h-8 rounded-lg bg-[#00B7B7] px-3 py-1 text-xs font-semibold text-white hover:bg-secondary-500">
                      Login
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Search Overlay */}
          <MobileSearchOverlay
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            role={session?.user.role ?? null}
          />

          {/* Desktop Navbar */}
          <div className="hidden w-full border-b border-neutral-50 bg-white sm:block">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3 lg:px-12 lg:py-4">
              {/* Logo Anmategra */}
              {session ? (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setIsSideBarOpen(true)}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>

                  <Link href={'/'}>
                    <Image
                      src={LogoAnmategra}
                      alt="Logo Anmategra"
                      width={48}
                      height={48}
                    />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center">
                  <Link href={'/'}>
                    <Image
                      src={LogoAnmategra}
                      alt="Logo Anmategra"
                      width={48}
                      height={48}
                    />
                  </Link>
                </div>
              )}

              {/* Input Search */}
              <SearchBar
                role={session?.user.role ?? null}
                className="mx-4 max-w-2xl flex-1"
              />

              {/* Profil */}
              <nav className="flex flex-shrink-0 items-center">
                {session ? (
                  <Link href={`/profile-mahasiswa/${session.user.id}`}>
                    {user?.image ? (
                      <Image
                        src={user.image}
                        alt="Profile User"
                        width={40}
                        height={40}
                        className="h-[40px] w-[40px] rounded-full object-cover"
                      />
                    ) : (
                      <Image
                        src={ProfilePic}
                        alt="Default Profile"
                        width={40}
                        height={40}
                        className="h-[40px] w-[40px] rounded-full object-cover"
                      />
                    )}
                  </Link>
                ) : (
                  <Link href={'/authentication'}>
                    <Button className="h-10 rounded-xl bg-[#00B7B7] px-6 py-2 text-lg font-semibold text-white hover:bg-secondary-500">
                      Login
                    </Button>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        </>
      )}
      {isSideBarOpen && session && (
        <>
          {/* Background overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setIsSideBarOpen(false)}
          />

          {/* Sidebar drawer */}
          <Sidebar session={session} onClose={() => setIsSideBarOpen(false)} />
        </>
      )}
    </>
  );
};

export default Navbar;
