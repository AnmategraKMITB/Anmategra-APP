import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/server';

type ToolKey = 'organization' | 'oprec' | 'forms';

const TOOLS: { key: ToolKey; label: string; path: string }[] = [
  { key: 'organization', label: 'Organogram', path: 'organogram' },
  { key: 'oprec', label: 'Open Recruitment', path: 'oprec' },
  { key: 'forms', label: 'Formulir', path: 'forms' },
];

/** `admin` mencakup semua fitur. */
const allows = (features: string[], key: ToolKey) =>
  features.includes('admin') || features.includes(key);

const ManageIndexPage = async () => {
  const [lembaga, kegiatan] = await Promise.all([
    api.adminGrant.getMyManagedLembaga(),
    api.adminGrant.getMyManagedEvents(),
  ]);

  const empty = lembaga.length === 0 && kegiatan.length === 0;

  // Kegiatan dikelompokkan per lembaga; kegiatan tanpa lembaga masuk "Lainnya".
  const groups = new Map<string, { name: string; items: typeof kegiatan }>();
  for (const item of kegiatan) {
    const key = item.lembagaId ?? 'lainnya';
    const group = groups.get(key) ?? {
      name: item.lembagaNama ?? 'Kegiatan lain',
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return (
    <div className="flex w-full flex-col gap-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-1000">Kelola</h1>
        <p className="text-sm text-neutral-600">
          Lembaga dan kegiatan yang kamu kelola, beserta alat yang boleh kamu
          pakai.
        </p>
      </div>

      {empty && (
        <p className="rounded-2xl border px-4 py-6 text-center text-neutral-600">
          Kamu belum mengelola lembaga atau kegiatan apa pun. Minta Owner
          lembaga untuk mengundangmu sebagai admin.
        </p>
      )}

      {lembaga.length > 0 && (
        <section aria-labelledby="manage-lembaga" className="space-y-3">
          <h2
            id="manage-lembaga"
            className="text-lg font-semibold text-neutral-1000"
          >
            Lembaga
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lembaga.map((l) => {
              const isAdmin = l.features.includes('admin');
              const card = (
                <>
                  <p className="font-medium">{l.lembagaNama}</p>
                  <p className="text-sm text-neutral-600">
                    {l.access === 'owner'
                      ? 'Owner'
                      : isAdmin
                        ? 'Admin Lembaga'
                        : 'Pengelola terbatas'}
                  </p>
                </>
              );
              return (
                <li key={l.lembagaId}>
                  {isAdmin ? (
                    <Link
                      href={`/manage/${l.lembagaId}`}
                      className="block rounded-2xl border px-4 py-3 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                    >
                      {card}
                    </Link>
                  ) : (
                    <div className="rounded-2xl border px-4 py-3">{card}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {[...groups.entries()].map(([key, group]) => (
        <section key={key} aria-label={`Kegiatan ${group.name}`} className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Kegiatan {group.name}
          </h2>
          <ul className="grid gap-3">
            {group.items.map((e) => (
              <li
                key={e.eventId}
                className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{e.eventNama}</p>
                  <p className="text-sm text-neutral-600">
                    {e.access === 'owner'
                      ? 'Owner'
                      : e.features.includes('admin')
                        ? 'Admin'
                        : 'Pengelola terbatas'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TOOLS.filter((t) => allows(e.features, t.key)).map((t) => (
                    <Button key={t.key} asChild variant="outline" size="sm">
                      <Link
                        href={`/manage/kegiatan/${e.eventId}/${t.path}`}
                      >
                        {t.label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ManageIndexPage;
