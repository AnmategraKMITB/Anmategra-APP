import { HasilPage } from '~/app/_components/oprec/hasil-page';

const HasilRoutePage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <HasilPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/mahasiswa"
    />
  );
};

export default HasilRoutePage;
