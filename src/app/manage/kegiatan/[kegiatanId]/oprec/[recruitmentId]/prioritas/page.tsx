import { PrioritasPage } from '~/app/_components/oprec/prioritas-page';

const PrioritasRoutePage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string; recruitmentId: string }>;
}) => {
  const { kegiatanId, recruitmentId } = await params;
  return (
    <PrioritasPage
      kegiatanId={kegiatanId}
      recruitmentId={recruitmentId}
      basePath="/manage"
    />
  );
};

export default PrioritasRoutePage;
