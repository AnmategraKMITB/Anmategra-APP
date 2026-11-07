import Link from 'next/link';

export const DEFAULT_CLOSED_MESSAGE =
  'Form ini sudah ditutup dan tidak menerima jawaban lagi.';

/** Kotak pemberitahuan satu halaman untuk keadaan isi form yang tidak biasa. */
export function Notice({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-[60vh] w-full max-w-2xl place-items-center px-4 py-10">
      <div
        role="status"
        className="w-full rounded-[24px] border border-neutral-400 bg-neutral-50 p-8 text-center"
      >
        <h1 className="text-2xl font-semibold text-neutral-1000">{title}</h1>
        {children ? (
          <div className="mt-2 text-neutral-700">{children}</div>
        ) : null}
        {action ? <div className="mt-6">{action}</div> : null}
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-primary-400 underline-offset-4 hover:underline"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
