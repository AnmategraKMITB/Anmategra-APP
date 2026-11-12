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
    <div className="w-full h-full mt-auto px-4 sm:px-8 md:px-12 lg:px-16 py-6 md:py-8 flex flex-col items-center justify-start border-t-2 border-slate-100 bg-white">
      <div className="h-full w-full flex flex-col md:flex-row items-start justify-between gap-6 md:gap-x-8">
        <div className="w-full flex flex-col gap-y-2 md:flex-[2]">
          {/* Tinggi sama, lebar mengikuti proporsi tiap logo (logo Kabinet lebih lebar). */}
          <div className="w-full h-full flex items-center gap-x-3 flex-wrap">
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
            <h3 className="text-lg sm:text-xl md:text-2xl text-Blue-Dark font-semibold my-2">
              Kementerian Anmategra<br className="hidden sm:block" />
            </h3>
            <p className="text-sm md:text-base text-Blue-Dark leading-5">
              Kemenkoan Pengembangan Sumber Daya Manusia (PSDM) <br className="hidden sm:block" /> Kabinet
              KM ITB 2026/2027 "Bermakna" 
            </p>
          </div>
          <div className="py-2">
            <p className="text-Blue-Dark text-sm md:text-[16px]">
              © 2026 Kementerian Anmategra KM ITB. Kode sumber terbuka di bawah{' '}
              <Link
                href="https://github.com/AnmategraKMITB/Anmategra-APP/blob/develop/LICENSE"
                className="underline underline-offset-2 hover:opacity-80"
              >
                Lisensi AGPL-3.0
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex flex-row md:contents gap-x-4 w-full">
          <div className="flex flex-col items-start justify-start w-full gap-y-2 md:flex-1">
            <h5 className="text-Blue-Dark text-lg md:text-xl font-medium">Narahubung</h5>
            <div>
              <p className="font-semibold text-Blue-Dark text-sm md:text-base">
                Z. Nayaka Athadiansyah
              </p>
              <div className="flex items-center gap-x-2">
                <Image src={LineLogo} alt="Logo Line" width={16} height={16} />
                <p className="text-Blue-Dark text-sm">nayaka.zna</p>
              </div>
            </div>
            <div className="py-[1px]" />
            <div>
              <p className="font-semibold text-Blue-Dark text-sm md:text-base">
                Narendra Dharma Wistara M.
              </p>
              <div className="flex items-center gap-x-2">
                <Image src={LineLogo} alt="Logo Line" width={16} height={16} />
                <p className="text-Blue-Dark text-sm">raulinns</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start justify-start w-full gap-y-2 md:flex-1">
            <h5 className="text-Blue-Dark text-lg md:text-xl font-medium">Ikuti Kami</h5>
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
              <p className="text-Blue-Dark text-sm">anmategra.itb</p>
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
              <p className="text-Blue-Dark text-sm">anmategra_itb</p>
            </Link>
            <div className="py-2" />
            <h5 className="text-Blue-Dark text-lg md:text-xl font-medium">Kontak Kami</h5>
            <p className="text-Blue-Dark text-sm">anmategra@km.itb.ac.id</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
