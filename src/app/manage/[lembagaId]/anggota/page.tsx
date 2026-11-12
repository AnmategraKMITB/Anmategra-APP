import Link from 'next/link';
import { notFound } from 'next/navigation';
import AnggotaContent from '~/app/lembaga/anggota/_components/anggota-content';
import { canManageLembaga } from '~/server/api/access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { api } from '~/trpc/server';

/**
 * Anggota lembaga bagi pengelola yang ditunjuk. Owner memakai /lembaga/anggota;
 * halaman ini memakai komponen yang sama dengan `lembagaId` dari URL.
 */
const ManageAnggotaPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  const session = await getServerAuthSession();
  if (!session) notFound();

  const { user } = session;
  const access = await canManageLembaga(
    db,
    user.id,
    user.role,
    user.lembagaId,
    lembagaId,
  );
  if (!access) notFound();

  const [anggota, posisiBidang, info] = await Promise.all([
    api.lembaga.getAllAnggota({ lembagaId }),
    api.lembaga.getPosisiBidangOptions({ lembagaId }),
    api.lembaga.getInfo({ lembagaId }),
  ]);

  return (
    <main className="py-6">
      <Link
        href={`/manage/${lembagaId}`}
        className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        ← {info?.nama ?? 'Lembaga'}
      </Link>
      <AnggotaContent
        session={session}
        data={anggota}
        dataPosisiBidang={posisiBidang}
        pageAnggota={true}
        title={info?.nama ?? ''}
        lembagaId={lembagaId}
        anggotaBasePath={`/manage/${lembagaId}/anggota`}
      />
    </main>
  );
};

export default ManageAnggotaPage;
