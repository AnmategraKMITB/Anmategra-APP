import { OprecListPage } from '~/app/_components/oprec/oprec-list-page';

const OprecPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  return <OprecListPage kegiatanId={kegiatanId} basePath="/manage" />;
};

export default OprecPage;
