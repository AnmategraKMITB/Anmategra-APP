import { redirect } from 'next/navigation';

/** Rute lama; halaman pengelola kini di /manage. */
const LegacyRedirectPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  redirect(`/manage/kegiatan/${kegiatanId}/oprec/${recruitmentId}/pendaftar`);
};

export default LegacyRedirectPage;
