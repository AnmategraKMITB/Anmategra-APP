import { FillPage } from '~/app/_components/forms/fill-page';

const FormFillPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  return <FillPage formId={formId} />;
};

export default FormFillPage;
