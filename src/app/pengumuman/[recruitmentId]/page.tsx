import { redirect } from 'next/navigation';
import { getServerAuthSession } from '~/server/auth';
import { AnnouncementView } from '~/app/_components/oprec/pengumuman/announcement-view';

export const metadata = {
  title: 'Pengumuman Hasil Oprec',
  robots: { index: false, follow: false },
};

const Page = async ({
  params,
}: {
  params: Promise<{ recruitmentId: string }>;
}) => {
  const { recruitmentId } = await params;
  const session = await getServerAuthSession();
  if (!session) {
    redirect(
      `/authentication?callbackUrl=${encodeURIComponent(`/pengumuman/${recruitmentId}`)}`,
    );
  }
  return <AnnouncementView recruitmentId={recruitmentId} />;
};

export default Page;
