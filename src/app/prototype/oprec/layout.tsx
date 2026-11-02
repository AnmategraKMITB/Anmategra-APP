import { type Metadata } from 'next';

import Wizard from './_components/wizard';

export const metadata: Metadata = {
  title: 'Purwarupa Oprec',
  description:
    'Purwarupa fitur Forms dan Manajemen Oprec Anmategra untuk uji coba bersama tim MSDM/HR.',
  // Purwarupa berisi data fiktif; jangan sampai muncul di hasil pencarian.
  robots: { index: false, follow: false },
};

export default function PrototypeOprecLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Wizard />
    </>
  );
}
