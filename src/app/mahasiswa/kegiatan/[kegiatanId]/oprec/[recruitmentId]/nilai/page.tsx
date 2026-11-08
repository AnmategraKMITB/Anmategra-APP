import { NilaiPage } from '~/app/_components/oprec/nilai-page';

const NilaiRoutePage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <NilaiPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/mahasiswa"
    />
  );
};

export default NilaiRoutePage;
