import { AkunDetail } from '~/app/_components/admin/akun-detail';

export default async function AdminAkunDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AkunDetail userId={userId} />;
}
