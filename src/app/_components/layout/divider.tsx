'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

const Divider = () => {
  const pathname = usePathname();

  if (pathname?.startsWith('/halaman-mahasiswa')) {
    return <div className="ml-[16rem] w-full" />;
  } else {
    return <div className="ml-0 w-full" />;
  }
};

export default Divider;
