import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { FormsList } from '~/app/_components/forms/forms-list';
import { getServerAuthSession } from '~/server/auth';
import { api } from '~/trpc/server';

const FormsPage = async () => {
  const session = await getServerAuthSession();
  const lembagaId = session?.user.lembagaId;
  const events = lembagaId ? await api.kegiatan.getAllByLembaga() : [];

  return (
    <main className="py-6 sm:py-8">
      <h1 className="text-[32px] font-semibold text-neutral-1000">Forms</h1>
      <p className="mt-1 text-neutral-700">
        Buat dan kelola form untuk lembaga ini. Form untuk satu kegiatan ada di
        bagian bawah.
      </p>

      {lembagaId ? (
        <div className="mt-6">
          <FormsList
            scope={{ type: 'lembaga', lembagaId }}
            basePath="/lembaga"
          />
        </div>
      ) : (
        <p className="mt-6 text-neutral-700">
          Akun ini belum terhubung ke lembaga.
        </p>
      )}

      {events.length > 0 ? (
        <section className="mt-10" aria-labelledby="form-kegiatan">
          <h2
            id="form-kegiatan"
            className="text-2xl font-semibold text-neutral-1000"
          >
            Form kegiatan
          </h2>
          <p className="mt-1 text-neutral-700">
            Pilih kegiatan untuk melihat atau membuat formnya.
          </p>
          <ul className="mt-4 divide-y divide-neutral-400 border-y border-neutral-400">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/lembaga/kegiatan/${event.id}/forms`}
                  className="flex items-center justify-between gap-4 px-2 py-4 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                >
                  <span className="min-w-0 truncate font-semibold text-neutral-1000">
                    {event.name}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-5 shrink-0 text-neutral-700"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
};

export default FormsPage;
