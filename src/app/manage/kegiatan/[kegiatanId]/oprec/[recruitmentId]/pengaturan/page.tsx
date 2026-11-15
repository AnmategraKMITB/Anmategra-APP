import { PengaturanPage } from '~/app/_components/oprec/pengaturan-page';

const PengaturanRoutePage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <PengaturanPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/manage"
    />
  );
};

export default PengaturanRoutePage;
