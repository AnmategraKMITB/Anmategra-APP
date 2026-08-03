import { MetadataRoute } from 'next';
import { BASE_URL } from '~/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const isDevSite = BASE_URL.includes('dev');

  return {
    rules: {
      userAgent: '*',
      allow: isDevSite ? [] : '/',
      disallow: isDevSite
        ? '/'
        : [
            '/api/',
            '/_next/',
            '/admin/',
            '/lembaga/',
            // Duplikat konten: /mahasiswa/profile-lembaga/[id] menampilkan
            // halaman yang sama dengan /profile-lembaga/[id] versi publik.
            '/mahasiswa/',
            '/authentication',
            '/auth-error',
            '/coming-soon',
          ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
