import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { canManageLembaga } from '~/server/api/access';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { api } from '~/trpc/server';

type ToolKey = 'organization' | 'oprec' | 'forms';

const TOOLS: { key: ToolKey; label: string; path: string }[] = [
  { key: 'organization', label: 'Organogram', path: 'organogram' },
  { key: 'oprec', label: 'Open Recruitment', path: 'oprec' },
  { key: 'forms', label: 'Formulir', path: 'forms' },
];

const allows = (features: string[], key: ToolKey) =>
  features.includes('admin') || features.includes(key);

/** Ringkasan pengelolaan satu lembaga: alat tingkat lembaga dan kegiatannya. */
const ManageLembagaPage = async ({
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

  const [info, events] = await Promise.all([
    api.lembaga.getInfo({ lembagaId }),
    api.adminGrant.getMyManagedEvents(),
  ]);
  const kegiatan = events.filter((e) => e.lembagaId === lembagaId);

  return (
    <div className="flex w-full flex-col gap-8 py-6">
      <div>
        <Link
          href="/manage"
          className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          ← Kelola
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-1000">
          {info?.nama ?? 'Lembaga'}
        </h1>
        <p className="text-sm text-neutral-600">
          {access === 'owner' ? 'Owner' : 'Admin Lembaga'}
        </p>
      </div>

      <section aria-labelledby="alat-lembaga" className="space-y-3">
        <h2
          id="alat-lembaga"
          className="text-lg font-semibold text-neutral-1000"
        >
          Alat lembaga
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/manage/${lembagaId}/anggota`}>Anggota</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/manage/${lembagaId}/anggota/rapor`}>Rapor</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/manage/${lembagaId}/profil`}>Profil lembaga</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/manage/${lembagaId}/inbox`}>Permintaan asosiasi</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/manage/${lembagaId}/kegiatan`}>Kelola kegiatan</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="kegiatan-lembaga" className="space-y-3">
        <h2
          id="kegiatan-lembaga"
          className="text-lg font-semibold text-neutral-1000"
        >
          Kegiatan
        </h2>
        {kegiatan.length === 0 ? (
          <p className="rounded-2xl border px-4 py-6 text-center text-neutral-600">
            Belum ada kegiatan di lembaga ini.
          </p>
        ) : (
          <ul className="grid gap-3">
            {kegiatan.map((e) => (
              <li
                key={e.eventId}
                className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="font-medium">{e.eventNama}</p>
                <div className="flex flex-wrap gap-2">
                  {TOOLS.filter((t) => allows(e.features, t.key)).map((t) => (
                    <Button key={t.key} asChild variant="outline" size="sm">
                      <Link href={`/manage/kegiatan/${e.eventId}/${t.path}`}>
                        {t.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ManageLembagaPage;
