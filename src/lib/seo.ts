import { env } from '~/env';

export const SITE_NAME = 'Anmategra';

export const SITE_DESCRIPTION =
  'Platform kemahasiswaan KM ITB. Telusuri profil himpunan, unit, dan kepanitiaan di ITB beserta anggota, kegiatan, dan rekam jejaknya.';

/**
 * Base URL tanpa trailing slash. NEXT_PUBLIC_BASE_URL bisa saja diisi dengan
 * akhiran '/', dan tanpa normalisasi ini setiap URL turunan jadi punya '//'.
 */
export const BASE_URL = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, '');

/**
 * URL absolut dari path internal. Nilai yang sudah absolut (mis. gambar dari
 * uploadthing) dikembalikan apa adanya supaya tidak jadi dobel host.
 */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const ITB_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Jl. Ganesha No.10',
  addressLocality: 'Bandung',
  addressRegion: 'Jawa Barat',
  postalCode: '40132',
  addressCountry: 'ID',
} as const;

export const ITB_ORGANIZATION = {
  '@type': 'CollegeOrUniversity',
  name: 'Institut Teknologi Bandung',
  alternateName: 'ITB',
  url: 'https://www.itb.ac.id',
} as const;

/**
 * Varian nama lembaga untuk `alternateName`, supaya query "HIMATEK" tetap
 * cocok dengan lembaga yang tersimpan sebagai "HIMATEK-ITB" (dan sebaliknya).
 *
 * Sengaja TIDAK menebak akronim dari nama panjang: nama di database sudah
 * campur bentuk panjang dan singkat, dan tebakan huruf depan menghasilkan
 * singkatan yang salah (mis. "Kemenkoan PSDM Kabinet KM ITB" -> "KPKK", yang
 * tidak dipakai siapa pun). Singkatan resmi butuh kolom sendiri di database.
 */
export function lembagaAlternateNames(name: string): string[] {
  const trimmed = name.trim();

  if (/itb/i.test(trimmed)) {
    const withoutItb = trimmed.replace(/[\s-]*ITB\s*$/i, '').trim();
    return withoutItb && withoutItb !== trimmed ? [withoutItb] : [];
  }

  return [`${trimmed} ITB`];
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
