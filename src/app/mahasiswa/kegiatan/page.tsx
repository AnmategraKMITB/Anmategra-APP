import { Metadata } from 'next';
import KegiatanPageContent from './_components/kegiatan-page-content';

export const metadata: Metadata = {
  // Suffix '| Anmategra' datang dari title.template di root layout.
  title: 'Daftar Kegiatan',
  description:
    'Jelajahi semua kegiatan mahasiswa, mulai dari seminar hingga open recruitment kepanitiaan.',
  robots: { index: false, follow: false },
};

const KegiatanPage = () => {
  return <KegiatanPageContent />;
};

export default KegiatanPage;
