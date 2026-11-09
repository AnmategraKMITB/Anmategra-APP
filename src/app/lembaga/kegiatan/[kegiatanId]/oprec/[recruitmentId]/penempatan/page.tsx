import { PenempatanPage } from '~/app/_components/oprec/penempatan-page';

const PenempatanRoutePage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <PenempatanPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/lembaga"
    />
  );
};

export default PenempatanRoutePage;
