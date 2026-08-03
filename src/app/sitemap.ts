import { MetadataRoute } from 'next';
import { BASE_URL, absoluteUrl } from '~/lib/seo';
import { api } from '~/trpc/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, organizations] = await Promise.all([
    api.landing.getAllEventIds({ limit: 100 }),
    api.landing.getAllLembagaIds({ limit: 100 }),
  ]);

  const eventEntries: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
    url: absoluteUrl(`/profile-kegiatan/${event.id}`),
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const lembagaEntries: MetadataRoute.Sitemap = (organizations ?? []).map(
    (org) => ({
      url: absoluteUrl(`/profile-lembaga/${org.id}`),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    }),
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      // Tanpa trailing slash, supaya persis sama dengan canonical yang
      // dirender Next di halaman beranda.
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  return [...staticPages, ...eventEntries, ...lembagaEntries];
}
