import { notFound } from 'next/navigation';

import { loadManagedForm } from './access';
import { ResponsesView } from './responses-view';

/** Halaman respons satu form; dipakai rute lembaga dan mahasiswa-admin. */
export async function ResponsesPage({
  formId,
  basePath,
}: {
  formId: string;
  basePath: '/lembaga' | '/mahasiswa';
}) {
  const managed = await loadManagedForm(formId);
  if (!managed) notFound();

  return (
    <ResponsesView
      formId={formId}
      title={managed.form.title}
      ownerName={managed.owner.name}
      backHref={`${basePath}/forms/${formId}`}
    />
  );
}
