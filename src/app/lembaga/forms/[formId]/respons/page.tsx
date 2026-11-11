import { ResponsesPage } from '~/app/_components/forms/responses-page';

const LembagaFormResponsesPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <ResponsesPage formId={formId} basePath="/lembaga" />;
};

export default LembagaFormResponsesPage;
