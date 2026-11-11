import Link from 'next/link';
import { notFound } from 'next/navigation';
import KelolaAdminPanel from '~/app/_components/kelola-admin/kelola-admin-panel';
import { api } from '~/trpc/server';

export default async function KelolaAdminLembagaPage({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) {
  const { lembagaId } = await params;
  const access = await api.adminGrant.getKelolaAdminAccess({ lembagaId });
  if (!access) notFound();

  return (
    <div className="flex w-full flex-col items-center px-6">
      <div className="flex w-full max-w-7xl flex-col gap-4 py-6">
        <Link
          href={`/mahasiswa/profile-lembaga/${lembagaId}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Kembali ke profil lembaga
        </Link>
        <h1 className="text-xl font-semibold text-slate-600 md:text-2xl">
          Kelola Admin
        </h1>
        <KelolaAdminPanel mode="lembaga" lembagaId={lembagaId} access={access} />
      </div>
    </div>
  );
}
