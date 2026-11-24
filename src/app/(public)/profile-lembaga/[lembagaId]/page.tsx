// Libray Import
// Icons Import
import { CalendarIcon } from 'lucide-react';
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

// Dipakai generateMetadata dan halaman; cache() membuat query-nya cukup jalan sekali per request.
const getLembagaPublic = cache((lembagaId: string) =>
  api.profile.getLembagaPublic({ lembagaId }),
);

export async function generateMetadata(props: {
  params: Promise<{ lembagaId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const path = `/profile-lembaga/${params.lembagaId}`;

  try {
    const { lembagaData } = await getLembagaPublic(params.lembagaId);

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
      await getLembagaPublic(lembagaId);

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
              <Link href={`/profile-kegiatan/${highlightedEvent.id}`}>
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
