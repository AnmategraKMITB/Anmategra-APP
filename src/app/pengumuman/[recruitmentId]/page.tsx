import { redirect } from 'next/navigation';
import { getServerAuthSession } from '~/server/auth';
import { AnnouncementView } from '~/app/_components/oprec/pengumuman/announcement-view';

export const metadata = {
  title: 'Pengumuman Hasil Oprec',
  robots: { index: false, follow: false },
};

const Page = async ({ params }: { params: { recruitmentId: string } }) => {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(
      `/authentication?callbackUrl=${encodeURIComponent(`/pengumuman/${params.recruitmentId}`)}`,
    );
  }
  return <AnnouncementView recruitmentId={params.recruitmentId} />;
};

export default Page;
