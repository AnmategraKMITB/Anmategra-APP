// Library Import
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
import KelolaAdminButton from '~/app/_components/kelola-admin/kelola-admin-button';
// Components Import
import { EventHeader } from '~/app/_components/placeholder/event-header';
import { PenyelenggaraCard } from '~/app/_components/placeholder/penyelenggara-card';
import { OrganogramDialog } from '~/app/_components/profile-kegiatan/organogram-dialog';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import { Button } from '~/components/ui/button';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

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
    const is_user_owner = session?.user?.lembagaId === lembaga?.id;

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

    return (
      <div className="flex min-h-screen w-full flex-col items-center px-6">
        <div className="w-full max-w-7xl bg-slate-50 py-6">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-slate-600 md:text-2xl">
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
            ajuanAsosiasi={Boolean(kegiatan?.id)}
            session={session}
          />
          <div className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-600 md:text-2xl">
              Deskripsi Kegiatan
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-800 md:px-6 md:py-4 md:text-base">
              {kegiatan?.description?.trim()
                ? kegiatan.description
                : 'Belum ada deskripsi untuk kegiatan ini.'}
            </div>
          </div>

          {/* Organogram Section */}
          {kegiatan?.is_organogram && kegiatan?.organogram_image && (
            <div className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-slate-600 md:text-2xl">
                Organogram
              </h2>
              <OrganogramDialog
                organogramImage={kegiatan.organogram_image}
                eventName={kegiatan.name ?? ''}
              />
            </div>
          )}

          <div className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-slate-600 md:text-2xl">
              Penyelenggara
            </h2>
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
          </div>

          {/* Best Staff Section */}
          {latestBestStaff && (
            <div className="mb-8 flex w-full flex-col gap-12">
              <div className="flex w-full flex-col gap-3">
                <div className="flex flex-row items-center justify-between">
                  <h2 className="text-2xl font-semibold text-[##141718]">
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
                  {is_user_owner && (
                    <Button asChild variant="ghost">
                      <Link
                        href={`/lembaga/profile-kegiatan/${query}/histori`}
                        className="flex items-center gap-2 text-lg"
                      >
                        <span>Lihat Histori</span>
                        <ChevronRight
                          className="!h-4 !w-4 text-slate-600"
                          aria-hidden
                        />
                      </Link>
                    </Button>
                  )}
                </div>
                <CarouselBestStaff
                  bestStaffList={latestBestStaff.best_staff_list}
                  isLembaga={true}
                />
              </div>
            </div>
          )}

          <ProfileAnggotaComp
            anggota={participant ?? []}
            session={session}
            kegiatanLembagaId={query ?? ''}
            raporVisible={kegiatan?.rapor_visible ?? false}
            isKegiatan={true}
          />
          <KelolaAdminButton
            href={`/lembaga/profile-kegiatan/${query}/kelola-admin`}
            eventId={query}
          />
        </div>
      </div>
    );
  } catch (error) {
    redirect('/404');
  }
};

export default ProfileKegiatan;
