'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { ErrorNote, Field, Loading, selectClass } from './shared';

/** Pengaturan visibilitas antar divisi (admin): bawaan + pengecualian pasangan. */
export function VisibilityPanel({
  recruitmentId,
  announce,
  onError,
  onChanged,
}: {
  recruitmentId: string;
  announce: (message: string) => void;
  onError: (message: string) => void;
  onChanged: () => void;
}) {
  const settings = api.oprec.visibilitySettings.useQuery({ recruitmentId });
  const [defaultChoice, setDefaultChoice] = useState<boolean | undefined>();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
  const [added, setAdded] = useState<
    { viewerDivisionId: string; targetDivisionId: string; allowed: boolean }[]
  >([]);
  const [viewer, setViewer] = useState('');
  const [target, setTarget] = useState('');

  const save = api.oprec.visibilitySave.useMutation({
    onSuccess: () => {
      announce('Pengaturan visibilitas disimpan.');
      setRemoved(new Set());
      setChanges(new Map());
      setAdded([]);
      setDefaultChoice(undefined);
      onChanged();
    },
    onError: (error) => onError(error.message),
  });

  if (settings.isError) return <ErrorNote message={settings.error.message} />;
  if (settings.isLoading || !settings.data)
    return <Loading label="Memuat pengaturan visibilitas…" />;

  const data = settings.data;
  const effectiveDefault = defaultChoice ?? data.default;
  const keyOf = (viewerId: string, targetId: string) =>
    `${viewerId}:${targetId}`;
  const labelOf = (id: string) =>
    data.divisions.find((division) => division.id === id)?.label ?? id;

  const existing = data.overrides
    .filter((row) => !removed.has(keyOf(row.viewerDivisionId, row.targetDivisionId)))
    .map((row) => ({
      ...row,
      allowed:
        changes.get(keyOf(row.viewerDivisionId, row.targetDivisionId)) ??
        row.allowed,
    }));

  return (
    <div className="grid gap-4">
      <label className="flex items-start gap-2 text-sm text-neutral-1000">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary-400"
          checked={effectiveDefault}
          onChange={(event) => setDefaultChoice(event.target.checked)}
        />
        <span>
          Izinkan Kadiv melihat pendaftar yang sudah diterima divisi lain
          (bawaan).
        </span>
      </label>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-neutral-1000">
          Pengecualian per pasangan
        </p>
        {existing.length === 0 ? (
          <p className="text-sm text-neutral-700">
            Belum ada pengecualian. Bawaan berlaku untuk semua pasangan.
          </p>
        ) : (
          <ul className="grid gap-1">
            {existing.map((row) => {
              const key = keyOf(row.viewerDivisionId, row.targetDivisionId);
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-400 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 text-neutral-1000">
                    {labelOf(row.viewerDivisionId)} melihat{' '}
                    {labelOf(row.targetDivisionId)}
                  </span>
                  <select
                    className={`${selectClass} w-auto`}
                    value={row.allowed ? 'ya' : 'tidak'}
                    aria-label={`Akses ${labelOf(row.viewerDivisionId)} ke ${labelOf(row.targetDivisionId)}`}
                    onChange={(event) =>
                      setChanges((prev) =>
                        new Map(prev).set(key, event.target.value === 'ya'),
                      )
                    }
                  >
                    <option value="ya">Izinkan</option>
                    <option value="tidak">Larang</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoved((prev) => new Set(prev).add(key))}
                  >
                    Hapus
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-2 rounded-xl bg-neutral-100 p-3">
        <p className="text-sm font-semibold text-neutral-1000">
          Tambah pengecualian
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Divisi penglihat">
            <select
              className={selectClass}
              value={viewer}
              onChange={(event) => setViewer(event.target.value)}
            >
              <option value="">Pilih</option>
              {data.divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Divisi yang dilihat">
            <select
              className={selectClass}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Pilih</option>
              {data.divisions.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="dark_blue_outline"
              disabled={viewer === '' || target === '' || viewer === target}
              onClick={() => {
                if (viewer === '' || target === '') return;
                setAdded((prev) => [
                  ...prev.filter(
                    (row) =>
                      keyOf(row.viewerDivisionId, row.targetDivisionId) !==
                      keyOf(viewer, target),
                  ),
                  {
                    viewerDivisionId: viewer,
                    targetDivisionId: target,
                    allowed: true,
                  },
                ]);
                setViewer('');
                setTarget('');
              }}
            >
              Tambah
            </Button>
          </div>
        </div>
        {added.length > 0 ? (
          <ul className="grid gap-1">
            {added.map((row) => (
              <li
                key={keyOf(row.viewerDivisionId, row.targetDivisionId)}
                className="text-sm text-neutral-700"
              >
                {labelOf(row.viewerDivisionId)} boleh melihat{' '}
                {labelOf(row.targetDivisionId)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              recruitmentId,
              default: effectiveDefault,
              overrides: [
                ...existing.map((row) => ({
                  viewerDivisionId: row.viewerDivisionId,
                  targetDivisionId: row.targetDivisionId,
                  allowed: row.allowed,
                })),
                ...added,
              ],
            })
          }
        >
          {save.isPending ? 'Menyimpan…' : 'Simpan visibilitas'}
        </Button>
      </div>
    </div>
  );
}
