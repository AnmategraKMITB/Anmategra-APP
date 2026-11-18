import { FillPage } from '~/app/_components/forms/fill-page';

const ShortFormFillPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <FillPage formId={formId} fillBasePath="/f" />;
};

export default ShortFormFillPage;
