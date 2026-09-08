'use client';

// Library Import
// Icon Import
import { Menu, Search } from 'lucide-react';
import { type Session } from 'next-auth';
// Next Auth Import
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfilePic from 'public/images/placeholder/profile-pic.png';
import LembagaPic from 'public/images/placeholder/profile-lembaga-kegiatan.png';
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

const Sidebar = Sidebars as (props: SidebarProps) => JSX.Element;

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
          <div className="sm:hidden w-full bg-white border-b border-neutral-50 fixed top-0 left-0 right-0 z-30">
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
                  className="w-8 h-8"
                >
                  <Search className="w-5 h-5" />
                </Button>

                <Button
                  onClick={() => setIsSideBarOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                >
                  <Menu className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden sm:block w-full bg-white border-b border-neutral-50">
            <div className="flex items-center justify-between max-w-[1440px] mx-auto py-3 px-6 lg:py-4 lg:px-12">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setIsSideBarOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9"
                >
                  <Menu className="w-5 h-5" />
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
                className="flex-1 max-w-2xl mx-4"
              />

              <nav className="flex items-center flex-shrink-0">
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
                    className="rounded-full object-cover w-[40px] h-[40px]"
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
          <div className="sm:hidden w-full bg-white border-b border-neutral-50 fixed top-0 left-0 right-0 z-30">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {session && (
                  <Button
                    onClick={() => setIsSideBarOpen(true)}
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                  >
                    <Menu className="w-5 h-5" />
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
                  className="w-8 h-8"
                >
                  <Search className="w-5 h-5" />
                </Button>

                {session ? (
                  <Link
                    href={`/profile-mahasiswa/${session.user.id}`}
                  >
                    {user?.image ? (
                      <Image
                        src={user.image}
                        alt="Profile User"
                        width={36}
                        height={36}
                        className="rounded-full object-cover w-[36px] h-[36px]"
                      />
                    ) : (
                      <Image
                        src={ProfilePic}
                        alt="Default Profile"
                        width={36}
                        height={36}
                        className="rounded-full object-cover w-[36px] h-[36px]"
                      />
                    )}
                  </Link>
                ) : (
                  <Link href={'/authentication'}>
                    <Button className="h-8 px-3 py-1 rounded-lg bg-[#00B7B7] text-white hover:bg-secondary-500 font-semibold text-xs">
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
          <div className="hidden sm:block w-full bg-white border-b border-neutral-50">
            <div className="flex items-center justify-between max-w-[1440px] mx-auto py-3 px-6 lg:py-4 lg:px-12">
              {/* Logo Anmategra */}
              {session ? (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setIsSideBarOpen(true)}
                    variant="ghost"
                    size="icon"
                    className="w-9 h-9"
                  >
                    <Menu className="w-5 h-5" />
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
                className="flex-1 max-w-2xl mx-4"
              />

              {/* Profil */}
              <nav className="flex items-center flex-shrink-0">
                {session ? (
                  <Link
                    href={`/profile-mahasiswa/${session.user.id}`}
                  >
                    {user?.image ? (
                      <Image
                        src={user.image}
                        alt="Profile User"
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-[40px] h-[40px]"
                      />
                    ) : (
                      <Image
                        src={ProfilePic}
                        alt="Default Profile"
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-[40px] h-[40px]"
                      />
                    )}
                  </Link>
                ) : (
                  <Link href={'/authentication'}>
                    <Button className="h-10 px-6 py-2 rounded-xl bg-[#00B7B7] text-white hover:bg-secondary-500 font-semibold text-lg">
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
