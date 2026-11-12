import { EventFormsPage } from '~/app/_components/forms/event-forms-page';

const MahasiswaKegiatanFormsPage = async ({
  params,
}: {
  params: Promise<{ kegiatanId: string }>;
}) => {
  const { kegiatanId } = await params;
  return <EventFormsPage kegiatanId={kegiatanId} basePath="/manage" />;
};

export default MahasiswaKegiatanFormsPage;
