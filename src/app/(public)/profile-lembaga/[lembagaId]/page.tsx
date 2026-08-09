// Libray Import
// Icons Import
import { CalendarIcon } from 'lucide-react';
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
import { JsonLd } from '~/app/_components/json-ld';
import ProfileAnggotaComp from '~/app/_components/profile-kegiatan/profil-kegiatan-comp';
import { Badge } from '~/components/ui/badge';
// Components Import
import { Card } from '~/components/ui/card';
import {
  ITB_ADDRESS,
  ITB_ORGANIZATION,
  absoluteUrl,
  breadcrumbJsonLd,
  lembagaAlternateNames,
} from '~/lib/seo';
// TRPC Import
import { api } from '~/trpc/server';

export async function generateMetadata({
  params,
}: {
  params: { lembagaId: string };
}): Promise<Metadata> {
  const path = `/profile-lembaga/${params.lembagaId}`;

  try {
    const { lembagaData } = await api.profile.getLembagaPublic({
      lembagaId: params.lembagaId,
    });

    const title = lembagaData.name;
    const description =
      lembagaData.description?.trim() ??
      `Profil ${lembagaData.name} di Anmategra: anggota, kepanitiaan, dan kegiatan lembaga kemahasiswaan KM ITB.`;
    const image =
      lembagaData.users.image || '/images/logo/anmategra-logo-full.png';

    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: {
        type: 'profile',
        url: path,
        title,
        description,
        images: [image],
      },
      twitter: { card: 'summary', title, description, images: [image] },
    };
  } catch {
    // Halaman ini redirect ke /404 kalau lembaga tidak ada. Tanpa catch,
    // generateMetadata melempar duluan dan yang muncul error page, bukan 404.
    return { title: 'Lembaga tidak ditemukan', robots: { index: false } };
  }
}

const DetailLembagaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  try {
    const lembagaId = (await params).lembagaId;
    const { lembagaData, newestEvent, highlightedEvent } =
      await api.profile.getLembagaPublic({ lembagaId: lembagaId });

    const path = `/profile-lembaga/${lembagaId}`;

    const alternateNames = lembagaAlternateNames(lembagaData.name);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${absoluteUrl(path)}#organization`,
      name: lembagaData.name,
      alternateName: alternateNames.length ? alternateNames : undefined,
      description: lembagaData.description ?? undefined,
      url: absoluteUrl(path),
      logo: lembagaData.users.image ?? undefined,
      image: lembagaData.users.image ?? undefined,
      foundingDate: lembagaData.foundingDate?.toISOString().slice(0, 10),
      parentOrganization: ITB_ORGANIZATION,
      address: ITB_ADDRESS,
    };

    const breadcrumbJson = breadcrumbJsonLd([
      { name: 'Beranda', path: '/' },
      { name: lembagaData.name, path },
    ]);

    return (
      <>
        <JsonLd data={jsonLd} />
        <JsonLd data={breadcrumbJson} />
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
              <Link href={`/profile-kegiatan/${highlightedEvent.id}`}>
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
              anggota={[]}
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
