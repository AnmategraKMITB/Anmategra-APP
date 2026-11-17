'use client';

import Link from 'next/link';
import { api } from '~/trpc/react';

/** Pemberitahuan hasil oprec di Inbox mahasiswa; muncul hanya setelah hasil tayang. */
export default function ResultNotifications() {
  const utils = api.useUtils();
  const { data } = api.oprec.myResultNotifications.useQuery();
  const markRead = api.oprec.markResultNotificationRead.useMutation({
    onSuccess: () => utils.oprec.myResultNotifications.invalidate(),
  });

  if (!data || data.length === 0) return null;

  return (
    <section aria-label="Pemberitahuan hasil oprec" className="mb-8">
      <h2 className="mb-3 text-[20px] font-semibold">Pemberitahuan</h2>
      <ul className="grid gap-3">
        {data.map((item) => (
          <li
            key={item.id}
            className={`rounded-[20px] border p-4 ${
              item.read
                ? 'border-neutral-400 bg-neutral-50'
                : 'border-primary-400 bg-white'
            }`}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-neutral-700">{item.content}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {item.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="underline"
                  onClick={() => {
                    if (!item.read) markRead.mutate({ id: item.id });
                  }}
                >
                  {link.label}
                </Link>
              ))}
              {!item.read && (
                <button
                  type="button"
                  className="text-neutral-700 underline"
                  onClick={() => markRead.mutate({ id: item.id })}
                >
                  Tandai sudah dibaca
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
