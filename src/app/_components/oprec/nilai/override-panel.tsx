'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { StatusBadge } from './status';

type Choice = RouterOutputs['oprec']['assessGet']['choices'][number];
type Decision = 'lolos' | 'tidak_lolos';

const DECISIONS = [
  ['lolos', 'Lolos'],
  ['tidak_lolos', 'Tidak lolos'],
] as const;

const when = (date: Date | null) =>
  date
    ? date.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      })
    : '—';

export function OverridePanel({
  recruitmentId,
  choice,
  onChanged,
}: {
  recruitmentId: string;
  choice: Choice;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Decision>('lolos');
  const [reason, setReason] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const setOverride = api.oprec.overrideSet.useMutation();
  const clearOverride = api.oprec.overrideClear.useMutation();
  const history = api.oprec.overrideHistory.useQuery(
    { recruitmentId, choiceId: choice.id },
    { enabled: historyOpen },
  );

  const override = choice.override;
  const pending = setOverride.isPending || clearOverride.isPending;

  const startEdit = () => {
    setStatus(override?.status === 'tidak_lolos' ? 'tidak_lolos' : 'lolos');
    setReason(override?.reason ?? '');
    setSensitive(override?.isSensitive ?? false);
    setFormError(null);
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed === '') {
      setFormError('Alasan wajib diisi.');
      return;
    }
    setFormError(null);
    setOverride.mutate(
      {
        recruitmentId,
        choiceId: choice.id,
        status,
        reason: trimmed,
        isSensitive: sensitive,
      },
      {
        onSuccess: () => {
          setEditing(false);
          onChanged();
        },
      },
    );
  };

  const clear = () => {
    clearOverride.mutate(
      { recruitmentId, choiceId: choice.id },
      { onSuccess: onChanged },
    );
  };

  return (
    <div className="mt-3 rounded-xl border border-neutral-400 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-700">Hitungan</span>
        <StatusBadge status={choice.computedStatus} />
        <span className="text-neutral-700">Efektif</span>
        <StatusBadge status={choice.effectiveStatus} />
      </div>

      {override ? (
        <div className="mt-2 grid gap-1.5">
          <span className="inline-flex w-fit items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-500">
            diubah manual
          </span>
          <p className="text-sm text-neutral-1000">
            {override.reason ?? 'Alasan disembunyikan'}
          </p>
          {override.needsReview ? (
            <p className="rounded-lg bg-warning-light px-3 py-2 text-sm text-neutral-1000">
              Perlu ditinjau ulang: nilai bergeser sejak diubah
            </p>
          ) : null}
        </div>
      ) : null}

      {!editing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {override ? (
            <>
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                disabled={pending}
                onClick={clear}
              >
                Kembalikan ke hitungan
              </Button>
              <Button
                type="button"
                variant="dark_blue_outline"
                size="sm"
                disabled={pending}
                onClick={startEdit}
              >
                Ubah lagi
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="dark_blue"
              size="sm"
              onClick={startEdit}
            >
              Ubah status
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <div
            role="radiogroup"
            aria-label="Status baru"
            className="flex flex-wrap gap-2"
          >
            {DECISIONS.map(([value, label]) => {
              const selected = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStatus(value)}
                  className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    selected
                      ? 'border-primary-400 bg-primary-400 text-neutral-50'
                      : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300 hover:bg-primary-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="grid gap-1 text-xs font-semibold text-neutral-700">
            Alasan
            <textarea
              value={reason}
              rows={3}
              aria-invalid={formError !== null}
              placeholder="Tuliskan alasan perubahan status"
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm font-normal text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            />
          </label>
          {formError ? (
            <p role="alert" className="text-sm text-danger-dark">
              {formError}
            </p>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(event) => setSensitive(event.target.checked)}
              className="mt-0.5 size-4 rounded border-neutral-400 accent-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            />
            <span>Alasan sensitif (hanya terlihat pengambil keputusan)</span>
          </label>

          {setOverride.isError ? (
            <p role="alert" className="text-sm text-danger-dark">
              {setOverride.error.message}
            </p>
          ) : null}
          {clearOverride.isError ? (
            <p role="alert" className="text-sm text-danger-dark">
              {clearOverride.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="dark_blue"
              size="sm"
              disabled={setOverride.isPending}
            >
              {setOverride.isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={setOverride.isPending}
              onClick={() => {
                setEditing(false);
                setFormError(null);
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      )}

      <details
        className="mt-3 border-t border-neutral-200 pt-2"
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
          Riwayat
        </summary>
        {history.isLoading ? (
          <p role="status" className="mt-2 text-sm text-neutral-700">
            Memuat riwayat…
          </p>
        ) : history.isError ? (
          <p role="alert" className="mt-2 text-sm text-danger-dark">
            Riwayat belum bisa dimuat: {history.error.message}
          </p>
        ) : history.data?.length ? (
          <ul className="mt-2 grid gap-2">
            {history.data.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-neutral-100 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  {item.isSensitive ? (
                    <span className="text-xs font-semibold text-neutral-700">
                      sensitif
                    </span>
                  ) : null}
                  <span className="text-xs text-neutral-700">
                    {when(item.setAt)}
                  </span>
                </div>
                <p className="mt-1 text-neutral-1000">
                  {item.reason ?? 'Alasan disembunyikan'}
                </p>
                {item.clearedAt ? (
                  <p className="mt-0.5 text-xs text-neutral-700">
                    Dikembalikan {when(item.clearedAt)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-700">Belum ada riwayat.</p>
        )}
      </details>
    </div>
  );
}
