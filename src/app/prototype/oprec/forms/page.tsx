'use client';

import dynamic from 'next/dynamic';

// Purwarupa memakai localStorage dan window, jadi hanya dirender di browser.
const AnmategraForms = dynamic(() => import('../_components/AnmategraForms'), {
  ssr: false,
});

export default function PrototypeFormsPage() {
  return <AnmategraForms />;
}
