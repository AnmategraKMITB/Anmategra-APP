import { FormsList } from '~/app/_components/forms/forms-list';

import { requireManagedLembaga } from '../../_lib/require-lembaga';

/** Form tingkat lembaga (bukan form kegiatan) untuk pengelola dan admin. */
const ManageLembagaFormsPage = async ({
  params,
}: {
  params: Promise<{ lembagaId: string }>;
}) => {
  const { lembagaId } = await params;
  await requireManagedLembaga(lembagaId, 'forms');

  return (
    <main className="py-6 sm:py-8">
      <h1 className="text-[32px] font-semibold text-neutral-1000">Forms</h1>
      <p className="mt-1 text-neutral-700">
        Form milik lembaga ini. Form untuk satu kegiatan dibuka dari halaman
        kegiatannya.
      </p>
      <div className="mt-6">
        <FormsList
          scope={{ type: 'lembaga', lembagaId }}
          basePath="/manage"
        />
      </div>
    </main>
  );
};

export default ManageLembagaFormsPage;
