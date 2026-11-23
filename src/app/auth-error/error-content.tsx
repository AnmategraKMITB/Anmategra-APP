'use client';

import { type Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '~/app/_components/layout/navbar';
import { Button } from '~/components/ui/button';

import Logo from '../../../public/images/logo/anmategra-logo-full.png';

export default function AuthErrorContent({
  session,
}: {
  session: Session | null;
}) {
  const getSearchParams = useSearchParams();
  const error = getSearchParams.get('error');

  return (
    <main className="flex h-screen items-center justify-center p-4">
      {/* <div className="mb-12 fixed w-full shadow-sm z-20">
        <Navbar session={session} />
      </div> */}

      {/* Error Content */}
      <div className="flex max-w-lg flex-col items-center text-center">
        <Image
          src={Logo}
          alt="Error Illustration"
          width={200}
          height={200}
          className="absolute top-10"
        />
        <h1 className="mb-4 text-4xl font-bold">Oops!</h1>
        {error === 'AccessDenied' ? (
          <p className="mb-8 text-lg text-gray-600">
            Maaf, Akun anda tidak memiliki akses pada aplikasi Anmategra.
            Silakan kontak admin jika ini merupakan kesalahan.
          </p>
        ) : (
          <p className="mb-8 text-lg text-gray-600">
            Maaf, Terjadi kesalahan pada proses autentikasi
          </p>
        )}
        <Button
          asChild
          variant="dark_blue"
          className="bg-[#2D3648] text-white hover:bg-[#1E2533]"
        >
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    </main>
  );
}
