'use client';

// Library Import
// Icons Import
import {
  CalendarIcon,
  EnvelopeOpenIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import {
  BookOpen,
  ClipboardList,
  FileText,
  LogOut,
  Network,
  Settings2,
  X,
} from 'lucide-react';
// Auth Import
import { type Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState } from 'react';
// Components Import
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
// Lib Import
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';

// Type Import

// Assets Import
import LogoAnmategraFull from '/public/images/logo/anmategra-logo-full.png';

type SidebarItemType = {
  label: string;
  href: string;
  icon: React.ReactElement;
};

type SidebarProfileData = {
  id: string;
  name: string;
  profilePicture: string;
  label: string;
  href: string;
};

const SIDEBAR_ITEMS_LEMBAGA: SidebarItemType[] = [
  { label: 'Beranda', href: '/', icon: <HomeIcon /> },
  { label: 'Kegiatan', href: '/kegiatan', icon: <CalendarIcon /> },
  { label: 'Anggota', href: '/anggota', icon: <PersonIcon /> },
  {
    label: 'Organogram',
    href: '/organogram',
    icon: <Network className="w-5 h-5" />,
  },
  { label: 'Forms', href: '/forms', icon: <FileText className="w-5 h-5" /> },
  {
    label: 'Oprec',
    href: '/oprec',
    icon: <ClipboardList className="w-5 h-5" />,
  },
  { label: 'Inbox', href: '/inbox', icon: <EnvelopeOpenIcon /> },
  {
    label: 'Laporan',
    href: '/laporan',
    icon: <ExclamationTriangleIcon />,
  },
  {
    label: 'Manual',
    href: '/manual',
    icon: <BookOpen className="w-5 h-5" />,
  },
];

const SIDEBAR_ITEMS_MAHASISWA: SidebarItemType[] = [
  { label: 'Beranda', href: '/mahasiswa', icon: <HomeIcon /> },
  { label: 'Kegiatan', href: '/mahasiswa/kegiatan', icon: <CalendarIcon /> },
  {
    label: 'Laporan',
    href: '/mahasiswa/laporan',
    icon: <ExclamationTriangleIcon />,
  },
  { label: 'Inbox', href: '/mahasiswa/inbox', icon: <EnvelopeOpenIcon /> },
  {
    label: 'Manual',
    href: '/manual',
    icon: <BookOpen className="w-5 h-5" />,
  },
];

// Muncul bagi mahasiswa yang memegang Grant (Admin Lembaga atau Admin Kegiatan);
// disisipkan sebelum item Manual.
const KELOLA_ITEM: SidebarItemType = {
  label: 'Kelola',
  href: '/manage',
  icon: <Settings2 className="w-5 h-5" />,
};

const SIDEBAR_ITEMS_ADMIN: SidebarItemType[] = [
  { label: 'Laporan', href: '/admin', icon: <ExclamationTriangleIcon /> },
  { label: 'Akun', href: '/admin/akun', icon: <PersonIcon /> },
  {
    label: 'Lembaga',
    href: '/admin/lembaga',
    icon: <Network className="w-5 h-5" />,
  },
  {
    label: 'Akses',
    href: '/admin/akses',
    icon: <ClipboardList className="w-5 h-5" />,
  },
  { label: 'Audit', href: '/admin/audit', icon: <FileText className="w-5 h-5" /> },
  {
    label: 'Manual',
    href: '/manual',
    icon: <BookOpen className="w-5 h-5" />,
  },
];

// Data profil di dasar sidebar; dipakai juga oleh editor organogram yang menaruh blok profil di panelnya sendiri.
const useSidebarProfile = (session: Session | null): SidebarProfileData => {
  const user = session?.user;
  const role = user?.role ?? 'mahasiswa';

  let profileData: SidebarProfileData;
  if (role === 'admin') {
    profileData = {
      id: user?.id ?? '',
      name: user?.name ?? 'Admin',
      profilePicture: user?.image ?? '/images/placeholder/profile-pic.png',
      label: 'Admin',
      href: '/admin',
    };
  } else if (role === 'lembaga') {
    const lembaga = api.lembaga.getInfo.useQuery(
      {
        lembagaId: user?.lembagaId ?? '',
      },
      { enabled: !!user?.lembagaId },
    ).data;

    profileData = {
      id: lembaga?.id ?? '',
      name: lembaga?.nama ?? '',
      profilePicture:
        lembaga?.foto ?? '/images/placeholder/profile-lembaga-kegiatan.png',
      label: 'Lembaga',
      href: `/profile-lembaga/${lembaga?.id ?? ''}`,
    };
  } else {
    const mahasiswa = api.users.getMahasiswaById.useQuery({
      userId: user?.id ?? '',
    })?.data?.mahasiswaData?.user;
    profileData = {
      id: user?.id ?? '',
      name: user?.name ?? '',
      profilePicture: mahasiswa?.image ?? '/images/placeholder/profile-pic.png',
      label: 'Mahasiswa',
      href: `/profile-mahasiswa/${user?.id ?? ''}`,
    };
  }

  return profileData;
};

export const SidebarAccount = ({
  session,
  onNavigate,
}: {
  session: Session | null;
  onNavigate?: () => void;
}) => {
  const profile = useSidebarProfile(session);
  return (
    <SidebarProfile
      profile={profile}
      role={session?.user?.role ?? 'mahasiswa'}
      onProfileClick={onNavigate}
    />
  );
};

export const Sidebar = ({
  session,
  onClose,
}: {
  session: Session | null;
  onClose?: () => void;
}) => {
  const user = session?.user;
  const role = user?.role ?? 'mahasiswa';

  const hasManagedScope =
    api.adminGrant.hasManagedScope.useQuery(undefined, {
      enabled: role === 'mahasiswa' && !!user?.id,
    }).data === true;

  const sidebarItems =
    role === 'lembaga'
      ? SIDEBAR_ITEMS_LEMBAGA
      : role === 'admin'
        ? SIDEBAR_ITEMS_ADMIN
        : hasManagedScope
          ? [
              ...SIDEBAR_ITEMS_MAHASISWA.slice(0, -1),
              KELOLA_ITEM,
              ...SIDEBAR_ITEMS_MAHASISWA.slice(-1),
            ]
          : SIDEBAR_ITEMS_MAHASISWA;

  const profileData = useSidebarProfile(session);

  return (
    <div className="fixed top-0 left-0 z-[60] flex h-screen w-64 flex-col border-r bg-neutral-50 p-6">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href={role === 'lembaga' ? '/lembaga' : role === 'admin' ? '/admin' : '/mahasiswa'}
          className="flex items-center"
          onClick={onClose}
        >
          <Image
            src={LogoAnmategraFull}
            alt="Logo Anmategra"
            width={150}
            height={50}
            style={{ width: 'auto', height: 'auto' }}
            priority
          />
        </Link>
        {onClose && (
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex h-full flex-col justify-between">
        <div className="space-y-[32px]">
          <SidebarItems
            items={sidebarItems}
            role={role}
            onItemClick={onClose}
          />
        </div>
        <SidebarProfile
          profile={profileData}
          role={role}
          onProfileClick={onClose}
        />
      </nav>
    </div>
  );
};

// Export function to control sidebar from navbar
export const useSidebarControl = () => {
  const [isOpen, setIsOpen] = useState(false);
  return { isOpen, setIsOpen };
};

const SidebarItems = ({
  items,
  role,
  onItemClick,
}: {
  items: SidebarItemType[];
  role: string;
  onItemClick?: () => void;
}) => {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-[16px]">
      {items.map((item) => (
        <TooltipProvider key={item.href}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className={cn(
                  'flex h-12 items-center justify-start rounded-[8px] px-4 text-[18px] text-[#636A6D] hover:bg-[#DFE7EC] hover:text-[#2B6282]',
                )}
                variant="ghost"
                asChild
              >
                <Link
                  href={item.href}
                  className={cn(
                    pathname === item.href && 'bg-[#DFE7EC] text-[#2B6282]',
                  )}
                  onClick={onItemClick}
                >
                  <div className="flex flex-row items-center gap-[12px]">
                    <span className="w-5 h-5">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              </Button>
            </TooltipTrigger>
            {role === 'lembaga' && (
              <TooltipContent side="right" className="lg:hidden">
                <p>{item.label}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
};

const SidebarProfile = ({
  profile,
  role,
  onProfileClick,
}: {
  profile: SidebarProfileData;
  role: string;
  onProfileClick?: () => void;
}) => {
  return (
    <div className="flex w-full flex-col gap-y-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={profile.href} onClick={onProfileClick}>
              <div className="flex items-center justify-start gap-4 px-1 py-2">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    className="object-cover"
                    src={profile.profilePicture ?? ''}
                  />
                  <AvatarFallback>{profile.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="m-0 line-clamp-1 text-left text-[18px] font-semibold">
                        {profile.name}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{profile.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="line-clamp-1 text-[16px] text-neutral-700">
                    {profile.label}
                  </span>
                </div>
              </div>
            </Link>
          </TooltipTrigger>
          {role === 'lembaga' && (
            <TooltipContent side="right" className="lg:hidden">
              <div>
                <p className="font-semibold">{profile.name}</p>
                <p className="text-xs">{profile.label}</p>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="warning"
              className="flex items-center justify-start gap-3 bg-transparent px-3 py-2 text-base text-destructive shadow-none hover:bg-red-50 hover:text-destructive-foreground"
              onClick={async () => {
                await signOut({ callbackUrl: '/' });
                onProfileClick?.();
              }}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span>Keluar</span>
            </Button>
          </TooltipTrigger>
          {role === 'lembaga' && (
            <TooltipContent side="right" className="lg:hidden">
              <p>Keluar</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
