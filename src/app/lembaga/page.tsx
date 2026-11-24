// "use server"
// import React from 'react';
// import LandingContent from "~/app/lembaga/landing-content";
import { api } from '~/trpc/server';

// import {getServerAuthSession} from "~/server/auth";
import HeroSection from '../_components/landing/hero';
import { KegiatanSection } from '../_components/landing/kegiatan-section';
import { KepanitiaanSection } from '../_components/landing/kepanitiaan-section';

// export default async function Home() {

//   const session = await getServerAuthSession();
//   const kegiatanTerbaru = await api.landing.getRecentEvents();
//   const kegiatanTerbesar = await api.landing.getTopEvents();

//   return (
//     <LandingContent data={{kegiatanTerbaru, kegiatanTerbesar}} session={session} />
//   );
// }

const LandingPage = async () => {
  const kegiatanTerbesar = await api.landing.getTopEvents();
  const kegiatanTerbaru = await api.landing.getRecentEvents();

  return (
    <main className="flex flex-col overflow-hidden sm:space-y-4 md:space-y-8">
      <HeroSection />
      <div className="space-y-16">
        <KegiatanSection data={kegiatanTerbaru} hideSeeAll />
        <KepanitiaanSection data={kegiatanTerbesar} hideSeeAll />
      </div>
    </main>
  );
};

export default LandingPage;
