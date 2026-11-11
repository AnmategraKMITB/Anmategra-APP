import { notFound } from 'next/navigation';

import { loadManagedForm } from './access';
import { ResponsesView } from './responses-view';
import { type AppBase } from '~/lib/app-base';

/** Halaman respons satu form; dipakai rute lembaga dan mahasiswa-admin. */
export async function ResponsesPage({
  formId,
  basePath,
}: {
  formId: string;
  basePath: AppBase;
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
