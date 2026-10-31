'use server';

import React from 'react';
import PencarianContent from '~/app/_components/pencarian/pencarian-content';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

export default async function SearchPage(
  props: {
    params: Promise<{ params: string }>;
  }
) {
  const params = await props.params;
  const query = decodeURIComponent(params.params);
  const session = await getServerAuthSession();
  const data = await api.landing.searchAll({ query: query });

  // normalize shape to match
  const transformedData = {
    ...data,
    mahasiswa: data.mahasiswa.map((m) => ({
      userId: m.userId,
      nama: m.nama ?? null,
      nim: Number(m.nim),
      jurusan: m.jurusan,
      image: m.image ?? null,
    })),
  };

  return (
    <PencarianContent
      session={session}
      data={transformedData}
      searchQuery={query}
    />
  );
}
