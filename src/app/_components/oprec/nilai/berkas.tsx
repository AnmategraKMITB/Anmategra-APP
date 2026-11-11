'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { type RouterOutputs, api } from '~/trpc/react';

import { AnswerList } from './answers';
import { CriterionCard } from './criterion-card';
import { FlagsBar } from './flags-bar';
import { OverridePanel } from './override-panel';
import { StatusBadge } from './status';

const PAGE_SIZE = 25;

type Criterion = RouterOutputs['oprec']['assessGet']['criteria'][number];
type GateState = NonNullable<NonNullable<Criterion['mine']>['gateState']>;

type SaveValue = {
  rating?: number | null;
  gateState?: GateState | null;
  note?: string | null;
};

function ProgressDots({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return <span className="text-xs text-neutral-700">Tanpa kriteria</span>;
  }
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`size-1.5 rounded-full ${
            index < done ? 'bg-primary-400' : 'bg-neutral-200'
          }`}
        />
      ))}
    </span>
  );
}

export function BerkasView({
  recruitmentId,
  scope,
  canDecide,
  ratingMin,
  ratingMax,
}: {
  recruitmentId: string;
  scope: string;
  canDecide: boolean;
  ratingMin: number;
  ratingMax: number;
}) {
  const [search, setSearch] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [pageState, setPageState] = useState({ key: '', page: 1 });
  const [selection, setSelection] = useState<{
    key: string;
    id: string;
  } | null>(null);
  const [activeCriterionId, setActiveCriterionId] = useState<string | null>(
    null,
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const deferredSearch = useDeferredValue(search.trim());
  const filterKey = JSON.stringify({
    search: deferredSearch,
    onlyIncomplete,
  });
  const page = pageState.key === filterKey ? pageState.page : 1;

  const meta = api.oprec.assessScopes.useQuery({ recruitmentId });
  const blind = meta.data?.blind ?? false;

  const queue = api.oprec.assessQueue.useQuery(
    {
      recruitmentId,
      scope,
      search: deferredSearch === '' ? undefined : deferredSearch,
      onlyIncomplete,
      page,
      pageSize: PAGE_SIZE,
      withValues: false,
    },
    { placeholderData: (previous) => previous },
  );

  const rows = queue.data?.rows ?? [];
  const defaultId =
    rows.find((row) => row.progress.done < row.progress.total)?.id ??
    rows[0]?.id ??
    null;
  const explicitId =
    selection?.key === filterKey ? (selection?.id ?? null) : null;
  const selectedId = explicitId ?? defaultId;

  const detail = api.oprec.assessGet.useQuery(
    { recruitmentId, scope, applicationId: selectedId ?? '' },
    { enabled: selectedId !== null },
  );

  const utils = api.useUtils();
  const saveMutation = api.oprec.assessSave.useMutation();

  const showSaved = useCallback(() => {
    const id = Date.now();
    setToast({ id, text: 'Tersimpan' });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 1800);
  }, []);

  const saveCriterion = useCallback(
    (criterion: Criterion, value: SaveValue) => {
      if (!selectedId) return;
      setSavingId(criterion.id);
      setSaveError(null);
      saveMutation.mutate(
        {
          recruitmentId,
          applicationId: selectedId,
          criterionId: criterion.id,
          choiceId: criterion.choiceId ?? null,
          rating: value.rating ?? null,
          gateState: value.gateState ?? null,
          note: value.note ?? null,
        },
        {
          onSuccess: () => {
            showSaved();
            void Promise.all([
              utils.oprec.assessGet.invalidate(),
              utils.oprec.assessQueue.invalidate(),
            ]);
          },
          onError: (error) => setSaveError(error.message),
          onSettled: () => {
            setSavingId((current) =>
              current === criterion.id ? null : current,
            );
          },
        },
      );
    },
    [recruitmentId, selectedId, saveMutation, showSaved, utils],
  );

  const refresh = useCallback(() => {
    void utils.oprec.assessGet.invalidate();
    void utils.oprec.assessQueue.invalidate();
  }, [utils]);

  const data = detail.data;
  const criteria = data?.criteria;
  const assessable = useMemo(
    () => (criteria ?? []).filter((item) => item.kind !== 'gugur_otomatis'),
    [criteria],
  );
  const activeCriterion =
    assessable.find((item) => item.id === activeCriterionId) ??
    assessable.find((item) => !item.mine) ??
    assessable[0] ??
    null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const list = queue.data?.rows ?? [];
      const index = list.findIndex((row) => row.id === selectedId);
      const key = event.key;

      if (key === 'j' || key === 'J' || key === 'ArrowDown') {
        const next = index < 0 ? list[0] : list[index + 1];
        if (next) {
          event.preventDefault();
          setSelection({ key: filterKey, id: next.id });
        }
        return;
      }

      if (key === 'k' || key === 'K' || key === 'ArrowUp') {
        const previous = index > 0 ? list[index - 1] : undefined;
        if (previous) {
          event.preventDefault();
          setSelection({ key: filterKey, id: previous.id });
        }
        return;
      }

      if (key === 'Enter') {
        if (!activeCriterion) return;
        event.preventDefault();
        const activeIndex = assessable.findIndex(
          (item) => item.id === activeCriterion.id,
        );
        const next = assessable[activeIndex + 1] ?? assessable[0] ?? null;
        if (next) setActiveCriterionId(next.id);
        return;
      }

      if (/^[1-9]$/.test(key)) {
        if (activeCriterion?.kind !== 'skor') return;
        if (!data?.open) return;
        const rating = Number(key);
        if (rating < ratingMin || rating > ratingMax) return;
        event.preventDefault();
        saveCriterion(activeCriterion, {
          rating,
          gateState: null,
          note: activeCriterion.mine?.note ?? null,
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeCriterion,
    assessable,
    data?.open,
    filterKey,
    queue.data?.rows,
    ratingMax,
    ratingMin,
    saveCriterion,
    selectedId,
  ]);

  const pages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside
        aria-label="Antrean penilaian"
        aria-busy={queue.isFetching}
        className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-3 sm:p-4"
      >
        <div className="grid gap-2">
          {blind ? null : (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau NIM"
                aria-label="Cari nama atau NIM"
                className="h-9 w-full rounded-lg border border-neutral-400 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-1000 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              />
            </div>
          )}
          <button
            type="button"
            aria-pressed={onlyIncomplete}
            onClick={() => setOnlyIncomplete((value) => !value)}
            className={`inline-flex h-8 w-fit items-center rounded-full border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
              onlyIncomplete
                ? 'border-primary-300 bg-primary-100 text-primary-500'
                : 'border-neutral-400 bg-neutral-50 text-neutral-700 hover:border-primary-300'
            }`}
          >
            Belum selesai
          </button>
        </div>

        {queue.isError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            Antrean belum bisa dimuat: {queue.error.message}
          </p>
        ) : !queue.data ? (
          <p role="status" className="mt-3 text-sm text-neutral-700">
            Memuat antrean…
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-700">
            Tidak ada pendaftar yang cocok.
          </p>
        ) : (
          <ul className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto lg:max-h-[calc(100vh-14rem)]">
            {rows.map((row) => {
              const first = row.choices[0];
              const selected = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelection({ key: filterKey, id: row.id })}
                    aria-current={selected ? 'true' : undefined}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                      selected
                        ? 'border-primary-300 bg-primary-100'
                        : 'border-transparent hover:bg-neutral-100'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-1000">
                          {row.name ?? row.code}
                        </span>
                        <span className="mt-0.5 block text-sm text-neutral-700">
                          {row.waveLabel ? `Gelombang ${row.waveLabel}` : '—'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-700">
                        <ProgressDots
                          done={row.progress.done}
                          total={row.progress.total}
                        />
                        <span>
                          {row.progress.done}/{row.progress.total}
                        </span>
                      </span>
                    </span>
                    {first ? (
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm text-neutral-700">
                          {first.label}
                        </span>
                        <StatusBadge status={first.status} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {queue.data ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700">
            <span>
              {queue.data.total} pendaftar · halaman {page} dari {pages}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="dark_blue_outline"
                size="sm"
                disabled={page <= 1 || queue.isFetching}
                onClick={() => setPageState({ key: filterKey, page: page - 1 })}
              >
                <ChevronLeft /> Sebelumnya
              </Button>
              <Button
                variant="dark_blue_outline"
                size="sm"
                disabled={page >= pages || queue.isFetching}
                onClick={() => setPageState({ key: filterKey, page: page + 1 })}
              >
                Berikutnya <ChevronRight />
              </Button>
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-neutral-700">
          J/K pindah, 1–5 beri skor, Enter lanjut
        </p>
      </aside>

      <section
        aria-label="Berkas penilaian"
        className="min-w-0 rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 sm:p-6"
      >
        <p
          role="status"
          aria-live="polite"
          className="h-5 text-sm font-semibold text-success-dark"
        >
          {toast?.text ?? ''}
        </p>
        {saveError ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
          >
            Nilai belum tersimpan: {saveError}
          </p>
        ) : null}

        {selectedId === null ? (
          <p className="text-sm text-neutral-700">
            Pilih pendaftar dari antrean untuk mulai menilai.
          </p>
        ) : detail.isError ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
          >
            Berkas belum bisa dimuat: {detail.error.message}
          </p>
        ) : !data ? (
          <p
            role="status"
            className="py-10 text-center text-sm text-neutral-700"
          >
            Memuat berkas…
          </p>
        ) : (
          <div className="grid gap-5">
            <header className="border-b border-neutral-200 pb-3">
              <h2 className="break-words text-xl font-semibold text-neutral-1000">
                {data.application.name ?? data.application.code}
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                {[
                  typeof data.application.nim === 'number'
                    ? `NIM ${data.application.nim}`
                    : null,
                  data.application.prodi,
                  typeof data.application.angkatan === 'number'
                    ? `Angkatan ${data.application.angkatan}`
                    : null,
                ]
                  .filter((value) => value !== null)
                  .join(' · ') || '—'}
              </p>
              <p className="mt-0.5 text-sm text-neutral-700">
                {[
                  data.application.waveLabel
                    ? `Gelombang ${data.application.waveLabel}`
                    : null,
                  data.application.willingToMove
                    ? 'Bersedia dipindahkan'
                    : null,
                ]
                  .filter((value) => value !== null)
                  .join(' · ') || '—'}
              </p>
            </header>

            {data.open ? null : (
              <p className="rounded-xl bg-warning-light px-4 py-3 text-sm text-neutral-1000">
                Penilaian pendaftar ini belum dibuka.
              </p>
            )}

            <FlagsBar
              recruitmentId={recruitmentId}
              applicationId={data.application.id}
              canCreateLabels={canDecide}
            />

            <section aria-labelledby="nilai-pilihan">
              <h3
                id="nilai-pilihan"
                className="text-sm font-semibold text-neutral-1000"
              >
                Pilihan
              </h3>
              <div className="mt-2 grid gap-3">
                {data.choices.map((choice) => (
                  <article
                    key={choice.id}
                    className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-700">
                          {typeof choice.rank === 'number'
                            ? `Pilihan ${choice.rank}`
                            : 'Tambahan'}
                        </p>
                        <h4 className="break-words text-base font-semibold text-neutral-1000">
                          {choice.label}
                        </h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {choice.override ? (
                          <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-500">
                            diubah manual
                          </span>
                        ) : null}
                        {choice.override?.needsReview ? (
                          <span className="inline-flex items-center rounded-full bg-warning-light px-2.5 py-0.5 text-xs font-semibold text-neutral-1000">
                            perlu ditinjau ulang
                          </span>
                        ) : null}
                        <StatusBadge status={choice.effectiveStatus} />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-neutral-700">
                      Skor{' '}
                      {typeof choice.score === 'number'
                        ? Math.round(choice.score)
                        : '—'}
                    </p>
                    {choice.canDecide ? (
                      <OverridePanel
                        recruitmentId={recruitmentId}
                        choice={choice}
                        onChanged={refresh}
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="nilai-kriteria">
              <h3
                id="nilai-kriteria"
                className="text-sm font-semibold text-neutral-1000"
              >
                Kriteria
              </h3>
              {data.criteria.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-700">
                  Belum ada kriteria penilaian untuk lingkup ini.
                </p>
              ) : (
                <div className="mt-2 grid gap-3">
                  {data.criteria.map((criterion) => (
                    <CriterionCard
                      key={criterion.id}
                      criterion={criterion}
                      ratingMin={ratingMin}
                      ratingMax={ratingMax}
                      disabled={!data.open}
                      active={activeCriterion?.id === criterion.id}
                      onActivate={() => {
                        if (criterion.kind !== 'gugur_otomatis') {
                          setActiveCriterionId(criterion.id);
                        }
                      }}
                      onSave={(value) => saveCriterion(criterion, value)}
                      saving={savingId === criterion.id}
                    />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="nilai-jawaban">
              <h3
                id="nilai-jawaban"
                className="text-sm font-semibold text-neutral-1000"
              >
                Jawaban
              </h3>
              <div className="mt-2">
                <AnswerList columns={data.columns} answers={data.answers} />
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
