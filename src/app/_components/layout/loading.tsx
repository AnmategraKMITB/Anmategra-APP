'use client';

import Image from 'next/image';

export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Image
        src="/images/loading/page-loading.png"
        alt="Loading animation"
        width={120}
        height={120}
        className="animate-spin"
        priority
      />
    </div>
  );
}
