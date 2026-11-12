import { redirect } from 'next/navigation';

/** Rute lama; halaman pengelola kini di /manage. */
const LegacyRedirectPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  redirect(`/manage/kegiatan/${kegiatanId}/forms`);
};

export default LegacyRedirectPage;
