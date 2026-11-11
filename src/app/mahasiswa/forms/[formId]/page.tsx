import { BuilderPage } from '~/app/_components/forms/builder-page';

const MahasiswaFormBuilderPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <BuilderPage formId={formId} basePath="/mahasiswa" />;
};

export default MahasiswaFormBuilderPage;
