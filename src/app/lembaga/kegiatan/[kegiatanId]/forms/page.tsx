import { EventFormsPage } from '~/app/_components/forms/event-forms-page';

const LembagaKegiatanFormsPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  return <EventFormsPage kegiatanId={kegiatanId} basePath="/lembaga" />;
};

export default LembagaKegiatanFormsPage;
