import type { Session } from 'next-auth';
import Image from 'next/image';
import Link from 'next/link';
import ComingSoonLeft from 'public/images/placeholder/coming-soon1.png';
import ComingSoonRight from 'public/images/placeholder/coming-soon2.png';
import { Button } from '~/components/ui/button';

export default function ComingSoonContent({
  session,
}: {
  session?: Session | null;
}) {
  return (
    <div className="z-10 min-h-screen bg-gray-50">
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <div className="relative flex min-h-screen w-full items-center justify-center text-center">
          <div className="absolute left-0 top-5 opacity-20">
            <Image
              src={ComingSoonLeft}
              alt="Coming Soon decoration - left"
              width={192}
              height={384}
              className="object-contain"
            />
          </div>
          <div className="absolute right-0 top-5 opacity-20">
            <Image
              src={ComingSoonRight}
              alt="Coming Soon decoration - right"
              width={192}
              height={384}
              className="object-contain"
            />
          </div>
          <div className="relative z-10 text-center">
            <h1 className="mb-6 text-6xl font-bold text-[#2B6777]">
              Coming Soon
            </h1>
            <p className="mb-12 text-2xl text-gray-400">
              Kami sedang membangun sesuatu yang menarik untuk Anda
            </p>
            {session?.user.role === 'lembaga' ? (
              <Link href="/">
                <Button variant="dark_blue" className="px-8 py-6 text-lg">
                  Kembali ke Beranda
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button variant="dark_blue" className="px-8 py-6 text-lg">
                  Kembali ke Beranda
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
