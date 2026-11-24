// import { Metadata } from 'next';
// import { env } from '~/env';
import { api } from '~/trpc/server';

import HeroSection from '../_components/landing/hero';
import { KegiatanSection } from '../_components/landing/kegiatan-section';
import { KepanitiaanSection } from '../_components/landing/kepanitiaan-section';

// export const metadata: Metadata = {
//   title: 'Anmategra',
//   description:
//     'Temukan dan ikuti berbagai kegiatan, kepanitiaan, dan organisasi mahasiswa terbaik.',
//   openGraph: {
//     title: 'Anmategra',
//     description: 'Pusat informasi kegiatan dan organisasi mahasiswa.',
//     url: `${env.NEXT_PUBLIC_BASE_URL}/mahasiswa`,
//     siteName: 'Anmategra',
//     images: [{ url: '/images/logo/anmategra-logo-full.png' }],
//     type: 'website',
//   },
// };

const LandingPage = async () => {
  const kegiatanTerbesar = await api.landing.getTopEvents();
  const kegiatanTerbaru = await api.landing.getRecentEvents();

  //   const jsonLd = {
  //     '@context': 'https://schema.org',
  //     '@type': 'WebSite',
  //     name: 'Anmategra',
  //     url: `${env.NEXT_PUBLIC_BASE_URL}/mahasiswa`,
  //     potentialAction: {
  //       '@type': 'SearchAction',
  //       target: `${env.NEXT_PUBLIC_BASE_URL}/mahasiswa/pencarian/{search_term_string}`,
  //     },
  //   };

  return (
    // <>
    //   <script
    //     type="application/ld+json"
    //     dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    //   />
    //   <main className="flex flex-col overflow-hidden sm:space-y-4 md:space-y-8">
    //     <HeroSection />
    //     <div className="space-y-16">
    //       <KegiatanSection data={kegiatanTerbaru} />
    //       <KepanitiaanSection data={kegiatanTerbesar} />
    //     </div>
    //   </main>
    // </>
    <main className="flex flex-col overflow-hidden sm:space-y-4 md:space-y-8">
      <HeroSection />
      <div className="space-y-16">
        <KegiatanSection data={kegiatanTerbaru} />
        <KepanitiaanSection data={kegiatanTerbesar} />
      </div>
    </main>
  );
};

export default LandingPage;
