'use client';

import Link from 'next/link';
import { Button } from '~/components/ui/button';

const CariKepanitiaanButton = () => {
  return (
    <Link href={`/`}>
      <Button className="rounded-lg bg-Blue-Dark px-8 py-2 font-semibold text-white hover:bg-Midnight-Blue">
        Cari Kepanitiaan
      </Button>
    </Link>
  );
};

export default CariKepanitiaanButton;
