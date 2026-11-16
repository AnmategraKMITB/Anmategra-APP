import Link from 'next/link';
import { notFound } from 'next/navigation';
import KelolaAdminPanel from '~/app/_components/kelola-admin/kelola-admin-panel';
import { api } from '~/trpc/server';

export default async function KelolaAdminKegiatanPage({
  params,
}: {
  params: Promise<{ profileKegiatanId: string }>;
}) {
  const { profileKegiatanId } = await params;
  const access = await api.adminGrant.getKelolaAdminAccess({
    eventId: profileKegiatanId,
  });
  if (!access) notFound();
  const { lembaga } = await api.profile.getKegiatan({
    kegiatanId: profileKegiatanId,
  });
  if (!lembaga?.id) notFound();

  return (
    <div className="flex w-full flex-col items-center px-6">
      <div className="flex w-full max-w-7xl flex-col gap-4 py-6">
        <Link
          href={`/lembaga/profile-kegiatan/${profileKegiatanId}`}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Kembali ke profil kegiatan
        </Link>
        <h1 className="text-xl font-semibold text-slate-600 md:text-2xl">
          Kelola Admin Kepanitiaan
        </h1>
        <KelolaAdminPanel
          mode="kegiatan"
          lembagaId={lembaga.id}
          eventId={profileKegiatanId}
          access={access}
        />
      </div>
    </div>
  );
}
