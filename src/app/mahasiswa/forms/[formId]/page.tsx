import { redirect } from 'next/navigation';

/** Rute lama; halaman pengelola kini di /manage. */
const LegacyRedirectPage = async ({
  params,
}: {
  params: Promise<{ formId: string }>;
}) => {
  const { formId } = await params;
  redirect(`/manage/forms/${formId}`);
};

export default LegacyRedirectPage;
