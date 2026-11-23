import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { Button } from '~/components/ui/button';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col items-center justify-center px-10 md:px-24">
        <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-16 md:flex-row">
          <div className="align-center flex h-96 w-48 shrink-0 items-center justify-center">
            <Image
              src="/images/miscellaneous/disks.png"
              alt="Coming Soon decoration"
              width={192}
              height={384}
            />
          </div>

          <div className="flex flex-col justify-center text-center md:text-left">
            <h1 className="text-Black mb-6 text-6xl font-bold">Oops!</h1>
            <p className="mb-12 text-2xl text-gray-400">
              Kami tidak dapat menemukan halaman yang Anda cari
            </p>
            <Link href="/">
              <Button variant="dark_blue" className="px-8 py-6 text-lg">
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;
