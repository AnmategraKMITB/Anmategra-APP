import { SetupPage } from '~/app/_components/oprec/setup-page';

const OprecBaruPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  return <SetupPage kegiatanId={kegiatanId} basePath="/lembaga" />;
};

export default OprecBaruPage;
