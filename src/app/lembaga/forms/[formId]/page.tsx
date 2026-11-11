import { BuilderPage } from '~/app/_components/forms/builder-page';

const LembagaFormBuilderPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <BuilderPage formId={formId} basePath="/lembaga" />;
};

export default LembagaFormBuilderPage;
