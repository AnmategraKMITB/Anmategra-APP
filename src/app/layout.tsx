// Font Import
import { GoogleAnalytics } from '@next/third-parties/google';
import { GeistSans } from 'geist/font/sans';
// Library Import
import { type Metadata } from 'next';
// Components Import
import { Toaster } from '~/components/ui/toaster';
import { env } from '~/env';
import { BASE_URL, SITE_DESCRIPTION, SITE_NAME } from '~/lib/seo';
import '~/styles/globals.css';
import { TRPCReactProvider } from '~/trpc/react';

import Footer from './_components/layout/footer';

// Metadata
export const metadata: Metadata = {
  // metadataBase bikin path relatif (mis. openGraph.images di halaman anak)
  // dirender jadi URL absolut. Tanpa ini preview share tidak memuat gambar.
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${SITE_NAME} — Platform Kemahasiswaan KM ITB`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Anmategra',
    'KM ITB',
    'ITB',
    'Institut Teknologi Bandung',
    'himpunan mahasiswa',
    'unit kegiatan mahasiswa',
    'kepanitiaan',
    'lembaga kemahasiswaan',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: SITE_NAME,
    url: '/',
    title: `${SITE_NAME} — Platform Kemahasiswaan KM ITB`,
    description: SITE_DESCRIPTION,
    images: ['/images/logo/anmategra-logo-full.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Platform Kemahasiswaan KM ITB`,
    description: SITE_DESCRIPTION,
    images: ['/images/logo/anmategra-logo-full.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: [{ rel: 'icon', url: '/images/favicon.ico' }],
  // Hanya dirender kalau env terisi; Search Console memakainya untuk
  // memverifikasi kepemilikan domain lewat metode "HTML tag".
  verification: { google: env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${GeistSans.variable}`}>
      <body className="bg-neutral-100 overflow-auto">
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </div>
          <div className="sticky z-[10]">
            <Footer />
          </div>
        </div>
        <Toaster />
        {/* Tanpa Measurement ID, GA tidak dipasang sama sekali — ini yang
            bikin kode aman di-merge sebelum property GA4-nya tersedia. */}
        {env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
