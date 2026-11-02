'use client';

import dynamic from 'next/dynamic';

// Purwarupa memakai window dan state acak di sisi klien, jadi hanya dirender di browser.
const ManajemenOprec = dynamic(() => import('../_components/ManajemenOprec'), {
  ssr: false,
});

export default function PrototypeManajemenPage() {
  return <ManajemenOprec />;
}
