'use client';

import { useId, useState } from 'react';
import { type RouterOutputs } from '~/trpc/react';

type Criterion = RouterOutputs['oprec']['assessGet']['criteria'][number];
type GateState = NonNullable<NonNullable<Criterion['mine']>['gateState']>;

type SaveValue = {
  rating?: number | null;
  gateState?: GateState | null;
  note?: string | null;
};

const SHORT_LABEL: Record<number, string> = {
  1: 'Kurang sekali',
  2: 'Kurang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat baik',
};

const GATE_OPTIONS = [
  ['memenuhi', 'Memenuhi'],
  ['ditinjau', 'Perlu ditinjau'],
  ['tidak', 'Tidak memenuhi'],
] as const;

function weightText(weight: unknown): string | null {
  if (typeof weight !== 'number' && typeof weight !== 'string') return null;
  const value = Number(weight);
  if (!Number.isFinite(value)) return null;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `bobot ${text}%`;
}

export function CriterionCard({
  criterion,
  ratingMin,
  ratingMax,
  disabled,
  active,
  onActivate,
  onSave,
  saving,
}: {
  criterion: Criterion;
  ratingMin: number;
  ratingMax: number;
  disabled: boolean;
  active: boolean;
  onActivate: () => void;
  onSave: (value: SaveValue) => void;
  saving: boolean;
}) {
  const headingId = useId();
  const noteId = `${headingId}-catatan`;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const mine = criterion.mine;
  const locked = disabled || saving;
  const ratings = Array.from(
    { length: Math.max(0, ratingMax - ratingMin + 1) },
    (_, index) => ratingMin + index,
  );
  const shortScale = ratingMin === 1 && ratingMax === 5;

  const meta = [
    criterion.kind === 'skor' ? weightText(criterion.weight) : null,
    criterion.reviewers > 1 ? `${criterion.reviewers} penilai` : null,
  ]
    .filter((value) => value !== null)
    .join(' · ');

  const chooseRating = (rating: number) => {
    const selected = mine?.rating === rating;
    onSave({
      rating: selected ? null : rating,
      gateState: null,
      note: mine?.note ?? null,
    });
  };

  const chooseGate = (value: GateState) => {
    const selected = mine?.gateState === value;
    onSave({
      rating: null,
      gateState: selected ? null : value,
      note: mine?.note ?? null,
    });
  };

  const saveNote = () => {
    const next = noteDraft.trim();
    const current = mine?.note ?? '';
    if (next === current) return;
    onSave({
      rating: criterion.kind === 'skor' ? (mine?.rating ?? null) : null,
      gateState:
        criterion.kind === 'gugur_manual' ? (mine?.gateState ?? null) : null,
      note: next === '' ? null : next,
    });
  };

  return (
    <section
      aria-labelledby={`${headingId}-judul`}
      onClick={onActivate}
      onFocusCapture={onActivate}
      className={`rounded-[24px] border bg-neutral-50 p-4 sm:p-5 ${
        active
          ? 'border-primary-300 ring-2 ring-primary-400'
          : 'border-neutral-400'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id={`${headingId}-judul`}
            className="text-base font-semibold text-neutral-1000"
          >
            {criterion.name}
          </h3>
          {meta ? (
            <p className="mt-0.5 text-xs font-semibold text-neutral-700">
              {meta}
            </p>
          ) : null}
          {criterion.expectation ? (
            <p className="mt-1 text-sm text-neutral-700">
              {criterion.expectation}
            </p>
          ) : null}
        </div>
        {criterion.kind !== 'gugur_otomatis' ? (
          <button
            type="button"
            aria-expanded={noteOpen}
            disabled={locked}
            onClick={() => {
              if (noteOpen) {
                setNoteOpen(false);
                return;
              }
              setNoteDraft(mine?.note ?? '');
              setNoteOpen(true);
            }}
            className="text-sm font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Catatan
          </button>
        ) : null}
      </div>

      {criterion.kind === 'skor' ? (
        <div
          role="radiogroup"
          aria-label={`Skor ${criterion.name}`}
          className="mt-4 flex flex-wrap gap-2"
        >
          {ratings.map((rating) => {
            const selected = mine?.rating === rating;
            const label = SHORT_LABEL[rating];
            return (
              <div key={rating} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-rate={rating}
                  disabled={locked}
                  onClick={() => chooseRating(rating)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-primary-400 bg-primary-400 text-neutral-50'
                      : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300 hover:bg-primary-100'
                  }`}
                >
                  {rating}
                </button>
                {shortScale && selected && label ? (
                  <span className="text-xs text-neutral-700">{label}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : criterion.kind === 'gugur_manual' ? (
        <div
          role="radiogroup"
          aria-label={`Status ${criterion.name}`}
          className="mt-4 flex flex-wrap gap-2"
        >
          {GATE_OPTIONS.map(([value, label]) => {
            const selected = mine?.gateState === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked}
                onClick={() => chooseGate(value)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 ${
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
      ) : (
        <div className="mt-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          <p>Dihitung otomatis dari jawaban pendaftar</p>
          {criterion.autoTriggered !== null &&
          criterion.autoTriggered !== undefined ? (
            <p
              className={`mt-1 font-semibold ${criterion.autoTriggered ? 'text-danger-dark' : 'text-success-dark'}`}
            >
              {criterion.autoTriggered
                ? 'Terpenuhi: pendaftar gugur'
                : 'Tidak terpenuhi'}
            </p>
          ) : null}
        </div>
      )}

      {noteOpen && criterion.kind !== 'gugur_otomatis' ? (
        <div className="mt-3">
          <label
            htmlFor={noteId}
            className="text-xs font-semibold text-neutral-700"
          >
            Catatan
          </label>
          <textarea
            id={noteId}
            value={noteDraft}
            disabled={locked}
            rows={3}
            placeholder="Catatan untuk kriteria ini"
            onChange={(event) => setNoteDraft(event.target.value)}
            onBlur={saveNote}
            className="mt-1 w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : null}
    </section>
  );
}
