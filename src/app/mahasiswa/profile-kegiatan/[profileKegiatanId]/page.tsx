// Library Import
import { ChevronRight } from 'lucide-react';
import { type Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
// Components Import
import { EventHeader } from '~/app/_components/placeholder/event-header';
import { PenyelenggaraCard } from '~/app/_components/placeholder/penyelenggara-card';
import { OrganogramDialog } from '~/app/_components/profile-kegiatan/organogram-dialog';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import { Button } from '~/components/ui/button';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

export async function generateMetadata({
  params,
}: {
  params: { profileKegiatanId: string };
}): Promise<Metadata> {
  const { kegiatan } = await api.profile.getKegiatan({
    kegiatanId: params.profileKegiatanId,
  });

  return {
    // Suffix '| Anmategra' datang dari title.template di root layout.
    title: kegiatan?.name,
    description: kegiatan?.description ?? 'Detail kegiatan mahasiswa.',
    // Halaman ini duplikat dari /profile-kegiatan/[id] versi publik dan hanya
    // bisa diakses setelah login. Versi publik yang jadi kanoniknya.
    robots: { index: false, follow: false },
    openGraph: {
      title: kegiatan?.name,
      description: kegiatan?.description ?? kegiatan?.name,
      images: [kegiatan?.image || '/images/logo/anmategra-logo.png'],
      type: 'website',
    },
  };
}

const ProfileKegiatan = async ({
  params,
}: {
  params: Promise<{ profileKegiatanId: string }>;
}) => {
  try {
    const query = (await params).profileKegiatanId;
    const { kegiatan, lembaga, participant } = await api.profile.getKegiatan({
      kegiatanId: query,
    });

    const session = await getServerAuthSession();
    const userId = session?.user?.id;
    const isParticipant = Boolean(
      userId && participant?.some((member) => member.id === userId),
    );
    const shouldHideAjuanAsosiasi = isParticipant;

    let latestBestStaff: {
      start_date: string;
      end_date: string;
      best_staff_list: {
        user_id: string;
        name: string;
        image: string | null;
        nim: string;
        jurusan: string;
        division: string;
      }[];
    } | null = null;
    try {
      latestBestStaff = await api.lembaga.getLatestBestStaffKegiatan({
        event_id: query,
      });
    } catch (error) {
      // console.log('No best staff data available for kegiatan:', query, error);
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: kegiatan?.name,
      description: kegiatan?.description,
      startDate: kegiatan?.start_date,
      endDate: kegiatan?.end_date,
      image: kegiatan?.image,
      organizer: {
        '@type': 'Organization',
        name: lembaga?.name,
      },
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
                      href: `/mahasiswa/profile-kegiatan/${query}`,
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
                ajuanAsosiasi={
                  Boolean(kegiatan?.id) && !shouldHideAjuanAsosiasi
                }
                linkDaftar={kegiatan?.oprec_link}
                session={session}
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
              <Link href={`/mahasiswa/profile-lembaga/${lembaga?.id}`}>
                <PenyelenggaraCard
                  title={lembaga?.name ?? 'Tidak ada nama'}
                  category={lembaga?.type ?? 'Tidak ada kategori'}
                  logo={
                    lembaga?.image ??
                    '/images/placeholder/profile-lembaga-kegiatan.png'
                  }
                />
              </Link>
              {/* Best Staff Section */}
              {latestBestStaff && (
                <div className="flex flex-col gap-12 w-full mt-8 mb-8">
                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-row justify-between items-center">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
                        Best Staff Periode{' '}
                        {new Date(
                          latestBestStaff.start_date,
                        ).toLocaleDateString('id-ID', {
                          month: 'long',
                          year: 'numeric',
                        })}
                        –
                        {new Date(latestBestStaff.end_date).toLocaleDateString(
                          'id-ID',
                          {
                            month: 'long',
                            year: 'numeric',
                          },
                        )}
                      </h2>
                      <Button asChild variant="ghost">
                        <Link
                          href={`/mahasiswa/profile-kegiatan/${query}/histori`}
                          className="flex items-center gap-2 text-lg"
                        >
                          <span>Lihat Histori</span>
                          <ChevronRight
                            className="!w-4 !h-4 text-slate-600"
                            aria-hidden
                          />
                        </Link>
                      </Button>
                    </div>
                    <CarouselBestStaff
                      bestStaffList={latestBestStaff.best_staff_list}
                      isLembaga={false}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <ProfileAnggotaComp
                  anggota={participant ?? []}
                  session={session}
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
