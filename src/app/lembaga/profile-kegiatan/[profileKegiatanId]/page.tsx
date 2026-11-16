// Library Import
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import React from 'react';
import { RaporBreadcrumb } from '~/app/_components/breadcrumb';
import KelolaAdminButton from '~/app/_components/kelola-admin/kelola-admin-button';
import CarouselBestStaff from '~/app/_components/carousel/carousel-best-staff';
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
      <div className="w-full flex min-h-screen flex-col items-center px-6">
        <div className="w-full max-w-7xl bg-slate-50 py-6">
          <div className="mb-4">
            <h1 className="text-xl md:text-2xl font-semibold text-slate-600">
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
            <h2 className="text-xl md:text-2xl font-semibold text-slate-600 mb-3">
              Deskripsi Kegiatan
            </h2>
            <div className="rounded-xl bg-white border border-neutral-200 px-4 py-3 md:px-6 md:py-4 text-sm md:text-base text-neutral-800 leading-relaxed">
              {kegiatan?.description?.trim()
                ? kegiatan.description
                : 'Belum ada deskripsi untuk kegiatan ini.'}
            </div>
          </div>

          {/* Organogram Section */}
          {kegiatan?.is_organogram && kegiatan?.organogram_image && (
            <div className="mb-8">
              <h2 className="text-xl md:text-2xl font-semibold text-slate-600 mb-3">
                Organogram
              </h2>
              <OrganogramDialog
                organogramImage={kegiatan.organogram_image}
                eventName={kegiatan.name ?? ''}
              />
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-600 mb-3">
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
            <div className="flex flex-col gap-12 w-full mb-8">
              <div className="flex flex-col gap-3 w-full">
                <div className="flex flex-row justify-between items-center">
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
                          className="!w-4 !h-4 text-slate-600"
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
