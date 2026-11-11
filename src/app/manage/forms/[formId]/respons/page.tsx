import { ResponsesPage } from '~/app/_components/forms/responses-page';

const MahasiswaFormResponsesPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <ResponsesPage formId={formId} basePath="/manage" />;
};

export default MahasiswaFormResponsesPage;
