// Libray Import
// Icons Import
import { CalendarIcon, ChevronRight } from 'lucide-react';
import { type Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
// Asset Import
import DummyFotoLembaga from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import DummyFotoEvent from 'public/images/placeholder/profile-lembaga-kegiatan.png';
import React, { cache } from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import { KepanitiaanCard } from '~/app/_components/card/kepanitiaan-card';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
import KelolaAdminButton from '~/app/_components/kelola-admin/kelola-admin-button';
import { PengumumanList } from '~/app/_components/oprec/pengumuman/pengumuman-list';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
// Components Import
import { Card } from '~/components/ui/card';
import { getServerAuthSession } from '~/server/auth';
// TRPC Import
import { type RouterOutputs } from '~/trpc/react';
import { api } from '~/trpc/server';

// Dipakai generateMetadata dan halaman; cache() membuat query-nya cukup jalan sekali per request.
const getLembaga = cache((lembagaId: string) =>
  api.profile.getLembaga({ lembagaId }),
);

export async function generateMetadata(props: {
  params: Promise<{ lembagaId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { lembagaData } = await getLembaga(params.lembagaId);

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
      await getLembaga(lembagaId);

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

    let pengumuman: RouterOutputs['oprec']['lembagaAnnouncements'] = [];
    try {
      pengumuman = await api.oprec.lembagaAnnouncements({ lembagaId });
    } catch {
      // Pengumuman opsional; profil tetap tampil tanpanya.
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
        <div className="flex min-h-screen w-full flex-col items-center px-[14px] pt-24 sm:pt-10">
          <div className="flex w-full max-w-7xl flex-col gap-4 py-6">
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
            <div className="flex w-full items-center justify-center gap-6 sm:py-12">
              <Image
                src={lembagaData?.users.image ?? DummyFotoLembaga}
                alt={lembagaData?.name ?? 'Foto Lembaga'}
                width={200}
                height={100}
                className="h-32 w-32 rounded-full object-cover md:h-48 md:w-48"
              />
              <article className="space-y-1">
                <p className="text-xl font-semibold text-slate-600 sm:text-2xl md:text-3xl">
                  {lembagaData?.name}
                </p>
                <p className="text-sm text-slate-400 sm:text-lg md:text-xl">
                  {lembagaData?.description}
                </p>
              </article>
            </div>

            {highlightedEvent && (
              <Link href={`/mahasiswa/profile-kegiatan/${highlightedEvent.id}`}>
                <div className="space-y-4 pb-12">
                  <h5 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
                    Highlighted Event
                  </h5>
                  <Card className="flex flex-col items-start gap-4 overflow-hidden p-4 transition-all hover:shadow-md sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                    <Image
                      src={highlightedEvent?.image ?? DummyFotoEvent}
                      alt={highlightedEvent?.name ?? 'Foto Kegiatan'}
                      className="h-[160px] w-full flex-shrink-0 object-cover sm:h-full sm:w-[220px] md:w-[260px]"
                      width={260}
                      height={160}
                    />
                    <div className="w-full space-y-2">
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
                      <p className="line-clamp-2 text-lg font-semibold leading-tight text-Blue-Dark sm:text-xl">
                        {highlightedEvent?.name}
                      </p>
                      <p className="line-clamp-3 text-sm leading-snug text-neutral-1000 sm:text-base">
                        {highlightedEvent?.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-Regent-Gray sm:text-sm">
                        <CalendarIcon className="h-4 w-4" />
                        {highlightedEvent?.start_date.toDateString()} -{' '}
                        {highlightedEvent?.end_date?.toDateString()}
                      </div>
                    </div>
                  </Card>
                </div>
              </Link>
            )}

            <PengumumanList items={pengumuman} />

            {/* Best Staff Section */}
            {latestBestStaff && (
              <div className="flex w-full flex-col gap-12 pb-12">
                <div className="flex w-full flex-col gap-3">
                  <div className="flex flex-row items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
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
                          className="!h-4 !w-4 text-slate-600"
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
              <h5 className="text-lg font-semibold text-slate-600 sm:text-xl md:text-2xl">
                Kepanitiaan Terbaru
              </h5>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            <KelolaAdminButton
              href={`/mahasiswa/profile-lembaga/${lembagaId}/kelola-admin`}
              lembagaId={lembagaId}
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
