// Component Import
import { type Metadata } from 'next';
import {
  ITB_ORGANIZATION,
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
} from '~/lib/seo';
// Auth Import
import { getServerAuthSession } from '~/server/auth';
// TRPC Import
import { api } from '~/trpc/server';

import { JsonLd } from './_components/json-ld';
import HeroSection from './_components/landing/hero';
import { KegiatanSection } from './_components/landing/kegiatan-section';
import { KepanitiaanSection } from './_components/landing/kepanitiaan-section';
import Navbar from './_components/layout/navbar';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${absoluteUrl('/')}#website`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: absoluteUrl('/'),
  inLanguage: 'id-ID',
  publisher: {
    '@type': 'Organization',
    name: 'Keluarga Mahasiswa ITB',
    alternateName: 'KM ITB',
    url: absoluteUrl('/'),
    logo: absoluteUrl('/images/logo/anmategra-logo-full.png'),
    parentOrganization: ITB_ORGANIZATION,
  },
};

const LandingPage = async () => {
  const kegiatanTerbesar = await api.landing.getTopEvents();
  const kegiatanTerbaru = await api.landing.getRecentEvents();
  const session = await getServerAuthSession();

  return (
    <main className="flex flex-col overflow-hidden pb-16 sm:space-y-4 md:space-y-8">
      <JsonLd data={websiteJsonLd} />
      <div className="mb-12 fixed w-full shadow-sm z-20">
        <Navbar session={session} />
      </div>
      <HeroSection />
      <div className="space-y-16">
        <KegiatanSection data={kegiatanTerbaru} />
        <KepanitiaanSection data={kegiatanTerbesar} />
      </div>
    </main>
  );
};

export default LandingPage;
