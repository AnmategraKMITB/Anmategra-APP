// Libray Import
// Icons Import
import { CalendarIcon, ChevronRight } from 'lucide-react';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
// Asset Import
import DummyFotoLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import DummyFotoEvent from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
// Components Import
import { Card } from '~/components/ui/card';
import { getServerAuthSession } from '~/server/auth';
// TRPC Import
import { api } from '~/trpc/server';

export async function generateMetadata({
  params,
}: {
  params: { lembagaId: string };
}): Promise<Metadata> {
  const { lembagaData } = await api.profile.getLembaga({
    lembagaId: params.lembagaId,
  });

  return {
    // Suffix '| Anmategra' datang dari title.template di root layout.
    title: lembagaData?.name,
    description: lembagaData?.description ?? 'Profil lembaga kemahasiswaan.',
    // Halaman ini duplikat dari /profile-lembaga/[id] versi publik dan hanya
    // bisa diakses setelah login. Versi publik yang jadi kanoniknya.
    robots: { index: false, follow: false },
    openGraph: {
      title: lembagaData?.name,
      description: lembagaData?.description ?? lembagaData?.name,
      images: [lembagaData?.users.image || '/images/logo/anmategra-logo.png'],
    },
  };
}

const DetailLembagaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  try {
    const lembagaId = (await params).lembagaId;
    const { lembagaData, newestEvent, highlightedEvent, anggota } =
      await api.profile.getLembaga({ lembagaId: lembagaId });

    const session = await getServerAuthSession();

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
      latestBestStaff = await api.lembaga.getLatestBestStaffLembaga({
        lembaga_id: lembagaId,
      });
    } catch (error) {
      console.log(
        'No best staff data available for lembaga:',
        lembagaId,
        error,
      );
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: lembagaData?.name,
      description: lembagaData?.description,
      logo: lembagaData?.users.image,
      member:
        anggota?.map((member) => ({
          '@type': 'OrganizationRole',
          member: {
            '@type': 'Person',
            name: member.nama,
          },
          roleName: member.posisi || 'Member',
        })) || [],
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="w-full flex min-h-screen flex-col items-center px-[14px] pt-24 sm:pt-10">
          <div className="flex max-w-7xl w-full flex-col gap-4 py-6">
            <div className="flex flex-col">
              <h1 className="text-2xl font-semibold text-slate-600">
                {lembagaData?.name}
              </h1>
              <RaporBreadcrumb
                items={[
                  { label: 'Beranda', href: '/' },
                  {
                    label: 'Profil Lembaga',
                    href: `/profile-lembaga/${lembagaId}`,
                  },
                ]}
              />
            </div>
            <div className="w-full flex items-center justify-center gap-6 sm:py-12">
              <Image
                src={lembagaData?.users.image ?? DummyFotoLembaga}
                alt={lembagaData?.name ?? 'Foto Lembaga'}
                width={200}
                height={100}
                className="rounded-full w-32 h-32 md:w-48 md:h-48 object-cover"
              />
              <article className="space-y-1">
                <p className="text-xl sm:text-2xl md:text-3xl text-slate-600 font-semibold">
                  {lembagaData?.name}
                </p>
                <p className="text-sm sm:text-lg md:text-xl text-slate-400">
                  {lembagaData?.description}
                </p>
              </article>
            </div>

            {highlightedEvent && (
              <Link href={`/mahasiswa/profile-kegiatan/${highlightedEvent.id}`}>
                <div className="space-y-4 pb-12">
                  <h5 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
                    Highlighted Event
                  </h5>
                  <Card className="transition-all hover:shadow-md overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6">
                    <Image
                      src={highlightedEvent?.image ?? DummyFotoEvent}
                      alt={highlightedEvent?.name ?? 'Foto Kegiatan'}
                      className="w-full sm:w-[220px] md:w-[260px] h-[160px] sm:h-full object-cover flex-shrink-0"
                      width={260}
                      height={160}
                    />
                    <div className="space-y-2 w-full">
                      <Badge className="space-x-2 rounded-full bg-Blue-Dark py-1">
                        <Image
                          src={lembagaData?.users.image ?? DummyFotoLembaga}
                          alt={lembagaData?.name ?? 'Foto Lembaga'}
                          width={20}
                          height={20}
                          className="rounded-full object-cover"
                        />
                        <p className="text-xs">{lembagaData?.name}</p>
                      </Badge>
                      <p className="text-lg sm:text-xl text-Blue-Dark font-semibold leading-tight line-clamp-2">
                        {highlightedEvent?.name}
                      </p>
                      <p className="text-sm sm:text-base text-neutral-1000 leading-snug line-clamp-3">
                        {highlightedEvent?.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-Regent-Gray">
                        <CalendarIcon className="h-4 w-4" />
                        {highlightedEvent?.start_date.toDateString()} -{' '}
                        {highlightedEvent?.end_date?.toDateString()}
                      </div>
                    </div>
                  </Card>
                </div>
              </Link>
            )}

            {/* Best Staff Section */}
            {latestBestStaff && (
              <div className="flex flex-col gap-12 w-full pb-12">
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex flex-row justify-between items-center">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
                      Best Staff Periode{' '}
                      {new Date(latestBestStaff.start_date).toLocaleDateString(
                        'id-ID',
                        {
                          month: 'long',
                          year: 'numeric',
                        },
                      )}
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
                        href={`/mahasiswa/profile-lembaga/${lembagaId}/histori`}
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
                    isLembaga={true}
                  />
                </div>
              </div>
            )}

            {/* Kepanitiaan Terbaru */}
            <div className="space-y-4 sm:pb-12">
              <h5 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600">
                Kepanitiaan Terbaru
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {newestEvent && newestEvent.length !== 0 ? (
                  newestEvent.map((item) => (
                    <Link href={`/profile-kegiatan/${item.id}`} key={item.id}>
                      <KepanitiaanCard kepanitiaan={item} />
                    </Link>
                  ))
                ) : (
                  <p className="text-slate-600">Belum ada kepanitiaan</p>
                )}
              </div>
            </div>

            {/* Anggota Section */}
            <ProfileAnggotaComp
              anggota={anggota ?? []}
              session={session}
              kegiatanLembagaId={lembagaId}
              raporVisible={lembagaData.raporVisible}
              isKegiatan={false}
            />
          </div>
        </div>
      </>
    );
  } catch (error) {
    redirect('/404');
  }
};

export default DetailLembagaPage;
