import { PublicPreviewPage } from '~/app/_components/forms/public-preview-page';

const FormPublicPreviewPage = async ({
  params,
}: {
  params: Promise<{ token: string }>;
}) => {
  const { token } = await params;
  return <PublicPreviewPage token={token} />;
};

export default FormPublicPreviewPage;
