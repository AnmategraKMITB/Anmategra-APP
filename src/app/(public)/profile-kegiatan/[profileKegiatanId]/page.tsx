// Library Import
import { type Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { JsonLd } from '~/app/_components/json-ld';
// Components Import
import { EventHeader } from '~/app/_components/placeholder/event-header';
import { PenyelenggaraCard } from '~/app/_components/placeholder/penyelenggara-card';
import { OrganogramDialog } from '~/app/_components/profile-kegiatan/organogram-dialog';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import {
  ITB_ADDRESS,
  ITB_ORGANIZATION,
  absoluteUrl,
  breadcrumbJsonLd,
} from '~/lib/seo';
import { api } from '~/trpc/server';

export async function generateMetadata({
  params,
}: {
  params: { profileKegiatanId: string };
}): Promise<Metadata> {
  const path = `/profile-kegiatan/${params.profileKegiatanId}`;

  try {
    const { kegiatan, lembaga } = await api.profile.getKegiatanPublic({
      kegiatanId: params.profileKegiatanId,
    });

    const title = kegiatan.name;
    const description =
      kegiatan.description?.trim() ??
      `${kegiatan.name} oleh ${lembaga.name}. Lihat kepanitiaan dan detail kegiatannya di Anmategra.`;
    const image =
      kegiatan.image ||
      kegiatan.background_image ||
      '/images/logo/anmategra-logo-full.png';

    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: 'article',
        url: path,
        title,
        description,
        images: [image],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    // Sejalan dengan redirect('/404') di komponen halaman.
    return { title: 'Kegiatan tidak ditemukan', robots: { index: false } };
  }
}

const ProfileKegiatan = async ({
  params,
}: {
  params: Promise<{ profileKegiatanId: string }>;
}) => {
  const query = (await params).profileKegiatanId;
  try {
    const { kegiatan, lembaga } = await api.profile.getKegiatanPublic({
      kegiatanId: query,
    });

    const path = `/profile-kegiatan/${query}`;
    const lembagaPath = `/profile-lembaga/${lembaga.id}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      '@id': `${absoluteUrl(path)}#event`,
      name: kegiatan.name,
      description: kegiatan.description ?? undefined,
      url: absoluteUrl(path),
      startDate: kegiatan.start_date.toISOString(),
      endDate: kegiatan.end_date?.toISOString(),
      // Rich Results menolak `image: null`, jadi selalu ada fallback.
      image: absoluteUrl(
        kegiatan.image ??
          kegiatan.background_image ??
          '/images/logo/anmategra-logo-full.png',
      ),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      organizer: {
        '@type': 'Organization',
        name: lembaga.name,
        url: absoluteUrl(lembagaPath),
      },
      location: {
        '@type': 'Place',
        name: kegiatan.location ?? ITB_ORGANIZATION.name,
        address: ITB_ADDRESS,
      },
    };

    const breadcrumbJson = breadcrumbJsonLd([
      { name: 'Beranda', path: '/' },
      { name: lembaga.name, path: lembagaPath },
      { name: kegiatan.name, path },
    ]);

    return (
      <>
        <JsonLd data={jsonLd} />
        <JsonLd data={breadcrumbJson} />
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="w-full flex min-h-screen flex-col items-center">
            <div className="w-full max-w-6xl bg-slate-50 py-6 rounded-none sm:rounded-xl">
              <div className="mb-4 px-1 sm:px-2">
                <h1 className="text-2xl font-semibold text-slate-600">
                  {kegiatan?.name}
                </h1>
                <RaporBreadcrumb
                  items={[
                    { label: 'Beranda', href: '/' },
                    {
                      label: 'Profil Kegiatan',
                      href: `/profile-kegiatan/${query}`,
                    },
                  ]}
                />
              </div>
              <EventHeader
                title={kegiatan?.name ?? 'null'}
                organizer={lembaga?.name ?? 'null'}
                backgroundImage={
                  kegiatan?.background_image ??
                  '/images/placeholder/banner-lembaga-kegiatan.png'
                }
                logoImage={
                  kegiatan?.image ??
                  '/images/placeholder/profile-lembaga-kegiatan.png'
                }
                eventId={kegiatan?.id ?? ''}
                ajuanAsosiasi={false}
                linkDaftar={kegiatan?.oprec_link}
              />
              <article className="mt-6 sm:mt-8 mb-8">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 mb-3">
                  Deskripsi Kegiatan
                </h2>
                <div className="rounded-xl bg-white border border-neutral-200 px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base text-neutral-800 leading-relaxed">
                  {kegiatan?.description?.trim()
                    ? kegiatan.description
                    : 'Belum ada deskripsi untuk kegiatan ini.'}
                </div>
              </article>

              {/* Organogram Section */}
              {kegiatan?.is_organogram && kegiatan?.organogram_image && (
                <div className="mt-6 sm:mt-8 mb-8">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 mb-3">
                    Organogram
                  </h2>
                  <OrganogramDialog
                    organogramImage={kegiatan.organogram_image}
                    eventName={kegiatan.name ?? ''}
                  />
                </div>
              )}

              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
                  Penyelenggara
                </h2>
              </div>
              <Link href={`/profile-lembaga/${lembaga?.id}`}>
                <PenyelenggaraCard
                  title={lembaga?.name ?? 'Tidak ada nama'}
                  category={lembaga?.type ?? 'Tidak ada kategori'}
                  logo={
                    lembaga?.image ??
                    '/images/placeholder/profile-lembaga-kegiatan.png'
                  }
                />
              </Link>

              <div className="mt-4">
                <ProfileAnggotaComp
                  anggota={[]}
                  kegiatanLembagaId={query ?? ''}
                  raporVisible={kegiatan?.rapor_visible ?? false}
                  isKegiatan={true}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  } catch (error) {
    redirect('/404');
  }
};

export default ProfileKegiatan;
