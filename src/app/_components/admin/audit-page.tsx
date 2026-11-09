'use client';

import { api } from '~/trpc/react';

export function AuditPage() {
  const list = api.adminConsole.auditList.useQuery({ page: 1, pageSize: 100 });
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-1000">Audit</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Jejak tindakan backoffice: pembuatan akun, perubahan status, dan
          pemberian/pencabutan akses.
        </p>
      </div>
      {list.isLoading ? (
        <p className="text-sm text-neutral-700">Memuat audit…</p>
      ) : list.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          {list.error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-neutral-400 bg-neutral-50">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-neutral-400 text-xs uppercase tracking-wide text-neutral-700">
              <tr>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">Aktor</th>
                <th className="px-3 py-2">Aksi</th>
                <th className="px-3 py-2">Ringkasan</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-b border-neutral-200 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-700">
                    {row.createdAt.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-neutral-1000">
                      {row.actorName ?? row.actorEmail}
                    </span>
                    <span className="block text-xs text-neutral-700">
                      {row.actorEmail}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.action}
                    <span className="block text-xs text-neutral-700">
                      {row.entityType}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.summary}</td>
                </tr>
              ))}
              {(list.data?.rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-neutral-700">
                    Belum ada audit.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
