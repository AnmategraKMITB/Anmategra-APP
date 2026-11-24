'use client';

// Library Import
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import InstagramLogo from 'public/icons/instagram-icon.png';
import LineLogo from 'public/icons/line-icon.png';
import XLogo from 'public/icons/x-icon.svg';
import AnmategraLogo from 'public/images/logo/anmategra-logo.svg';
// Assets Import
import KMLogo from 'public/images/logo/kmitb-logo.jpeg';
import KabinetLogo from 'public/images/logo/logo-kabinet.svg';
import PSDMLogo from 'public/images/logo/logo-psdm.svg';
import React from 'react';

const Footer = () => {
  const pathname = usePathname();

  // Purwarupa memakai layout layar penuh sendiri.
  if (pathname.startsWith('/prototype')) {
    return null;
  }

  return (
    <div className="mt-auto flex h-full w-full flex-col items-center justify-start border-t-2 border-slate-100 bg-white px-4 py-6 sm:px-8 md:px-12 md:py-8 lg:px-16">
      <div className="flex h-full w-full flex-col items-start justify-between gap-6 md:flex-row md:gap-x-8">
        <div className="flex w-full flex-col gap-y-2 md:flex-[2]">
          {/* Tinggi sama, lebar mengikuti proporsi tiap logo (logo Kabinet lebih lebar). */}
          <div className="flex h-full w-full flex-wrap items-center gap-x-3">
            <Image
              src={KMLogo}
              alt="Logo KM ITB"
              className="h-14 w-auto sm:h-16 md:h-[72px]"
            />
            <Image
              src={KabinetLogo}
              alt="Logo Kabinet KM ITB 2026/2027 Bermakna"
              className="h-14 w-auto sm:h-16 md:h-[72px]"
            />
            <Image
              src={PSDMLogo}
              alt="Logo Kemenkoan PSDM KM ITB"
              className="h-14 w-auto sm:h-16 md:h-[72px]"
            />
            <Image
              src={AnmategraLogo}
              alt="Logo Anmategra"
              className="h-14 w-auto sm:h-16 md:h-[72px]"
            />
          </div>
          <div>
            <h3 className="my-2 text-lg font-semibold text-Blue-Dark sm:text-xl md:text-2xl">
              Kementerian Anmategra
              <br className="hidden sm:block" />
            </h3>
            <p className="text-sm leading-5 text-Blue-Dark md:text-base">
              Kemenkoan Pengembangan Sumber Daya Manusia (PSDM){' '}
              <br className="hidden sm:block" /> Kabinet KM ITB 2026/2027
              "Bermakna"
            </p>
          </div>
          <div className="py-2">
            <p className="text-sm text-Blue-Dark md:text-[16px]">
              © 2026 Kementerian Anmategra KM ITB. Kode sumber terbuka di bawah{' '}
              <Link
                href="https://github.com/AnmategraKMITB/Anmategra-APP/blob/develop/LICENSE"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Lisensi AGPL-3.0
              </Link>
              .
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-Blue-Dark md:text-[16px]">
              <Link
                href="/privasi"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Kebijakan Privasi
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/ketentuan"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Syarat dan Ketentuan
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/privacy"
                hrefLang="en"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Privacy Policy
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                href="/terms"
                hrefLang="en"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
        <div className="flex w-full flex-row gap-x-4 md:contents">
          <div className="flex w-full flex-col items-start justify-start gap-y-2 md:flex-1">
            <h5 className="text-lg font-medium text-Blue-Dark md:text-xl">
              Narahubung
            </h5>
            <div>
              <p className="text-sm font-semibold text-Blue-Dark md:text-base">
                Z. Nayaka Athadiansyah
              </p>
              <div className="flex items-center gap-x-2">
                <Image src={LineLogo} alt="Logo Line" width={16} height={16} />
                <p className="text-sm text-Blue-Dark">nayaka.zna</p>
              </div>
            </div>
            <div className="py-[1px]" />
            <div>
              <p className="text-sm font-semibold text-Blue-Dark md:text-base">
                Narendra Dharma Wistara M.
              </p>
              <div className="flex items-center gap-x-2">
                <Image src={LineLogo} alt="Logo Line" width={16} height={16} />
                <p className="text-sm text-Blue-Dark">raulinns</p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start justify-start gap-y-2 md:flex-1">
            <h5 className="text-lg font-medium text-Blue-Dark md:text-xl">
              Ikuti Kami
            </h5>
            <Link
              href="https://instagram.com/anmategra.itb"
              className="flex items-center gap-x-2"
            >
              <Image
                src={InstagramLogo}
                alt="Logo Instagram"
                width={16}
                height={16}
              />
              <p className="text-sm text-Blue-Dark">anmategra.itb</p>
            </Link>
            <Link
              href="https://x.com/anmategra_itb?s=21"
              className="flex items-center gap-x-2"
            >
              <Image
                src={XLogo}
                alt="Logo X"
                width={16}
                height={16}
                style={{ width: 'auto', height: 'auto' }}
              />
              <p className="text-sm text-Blue-Dark">anmategra_itb</p>
            </Link>
            <div className="py-2" />
            <h5 className="text-lg font-medium text-Blue-Dark md:text-xl">
              Kontak Kami
            </h5>
            <p className="text-sm text-Blue-Dark">anmategra@km.itb.ac.id</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
