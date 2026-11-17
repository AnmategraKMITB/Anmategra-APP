'use client';

import dynamic from 'next/dynamic';

// Deck membaca ukuran layar dan hash URL sejak render pertama, jadi hanya
// dirender di browser supaya tidak terjadi hydration mismatch.
export const DeckClient = dynamic(
  () =>
    import('~/app/_components/slides/sneakpeek').then(
      (mod) => mod.SneakPeekDeck,
    ),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 bg-primary-1000" />,
  },
);
