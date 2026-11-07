import { notFound } from 'next/navigation';

import { loadManagedForm } from './access';
import { FormBuilder } from './builder-shell';

/** Halaman builder satu form; dipakai rute lembaga dan mahasiswa-admin. */
export async function BuilderPage({
  formId,
  basePath,
}: {
  formId: string;
  basePath: '/lembaga' | '/mahasiswa';
}) {
  const managed = await loadManagedForm(formId);
  if (!managed) notFound();
  const { owner } = managed;

  const isEvent = owner.type === 'event';
  const backHref = isEvent
    ? `${basePath}/kegiatan/${owner.id}/forms`
    : basePath === '/lembaga'
      ? '/lembaga/forms'
      : '/mahasiswa';
  const backLabel = isEvent
    ? 'Form kegiatan'
    : basePath === '/lembaga'
      ? 'Semua form'
      : 'Beranda';

  return (
    <FormBuilder
      formId={formId}
      backHref={backHref}
      backLabel={backLabel}
      responsesHref={`${basePath}/forms/${formId}/respons`}
      ownerName={owner.name}
    />
  );
}
