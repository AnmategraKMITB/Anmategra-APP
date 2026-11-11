// Library Import
// Icons Import
import { redirect } from 'next/navigation';
import React from 'react';
// Components Import
import { getServerAuthSession } from '~/server/auth';
// TRPC Import
import { api } from '~/trpc/server';

import ProfileLembagaContent from './profile-lembaga-content';

const DetailLembagaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  try {
    const session = await getServerAuthSession();
    const lembagaId = (await params).lembagaId;
    // Dijalankan paralel; best staff boleh gagal (belum ada data) tanpa
    // menggagalkan halaman.
    const bestStaffPromise = api.lembaga
      .getLatestBestStaffLembaga({ lembaga_id: lembagaId })
      .catch(() => null);
    const { lembagaData, newestEvent, highlightedEvent, anggota } =
      await api.profile.getLembaga({ lembagaId: lembagaId });

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
    latestBestStaff = await bestStaffPromise;

    return (
      <ProfileLembagaContent
        lembagaId={lembagaId}
        session={session}
        lembagaData={lembagaData}
        newestEvent={newestEvent}
        highlightedEvent={highlightedEvent}
        anggota={anggota}
        latestBestStaff={latestBestStaff}
        isLembaga={true}
      />
    );
  } catch (error) {
    redirect('/404');
  }
};

export default DetailLembagaPage;
