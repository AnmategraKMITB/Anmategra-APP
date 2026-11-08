'use client';

import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { type RouterOutputs, api } from '~/trpc/react';

import { useBuilder } from '../builder-context';
import { richTextToPlain } from '../rich-text';
import { CriterionDialog } from './criterion-dialog';
import { SheetDialog } from './sheet-dialog';

type CriteriaListOutput = RouterOutputs['oprec']['criteriaList'];
type Slot = CriteriaListOutput['slots'][number];
type Criterion = Slot['criteria'][number];
type LinkedField = CriteriaListOutput['fields'][number];

function kindLabel(kind: string): string {
  if (kind === 'skor') return 'Skor';
  if (kind === 'gugur_otomatis') return 'Gugur otomatis';
  if (kind === 'gugur_manual') return 'Gugur manual';
  return kind;
}

function kindClass(kind: string): string {
  if (kind === 'skor') return 'bg-primary-100 text-primary-400';
  if (kind === 'gugur_otomatis') return 'bg-danger-light text-danger-dark';
  return 'bg-warning-light text-warning-dark';
}

function WeightSummary({ slot }: { slot: Slot }) {
  if (!slot.criteria.some((item) => item.kind === 'skor')) {
    return <p className="text-sm text-neutral-700">Belum ada kriteria skor</p>;
  }
  const ok = slot.weightSum === 100;
  return (
    <p
      className={cn(
        'text-sm font-semibold',
        ok ? 'text-success-dark' : 'text-warning-dark',
      )}
    >
      Total bobot {slot.weightSum}%{ok ? '' : ' — sebaiknya 100%'}
    </p>
  );
}

function CriterionCard({
  criterion,
  index,
  total,
  fields,
  moving,
  onMove,
  onEdit,
  onDelete,
}: {
  criterion: Criterion;
  index: number;
  total: number;
  fields: CriteriaListOutput['fields'];
  moving: boolean;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const linked = criterion.fieldIds
    .map((fieldId) => fields.find((field) => field.id === fieldId))
    .filter((field): field is LinkedField => field !== undefined);

  return (
    <li className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-sm font-semibold text-neutral-1000">
            {criterion.name}
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-0.5 text-sm',
              kindClass(criterion.kind),
            )}
          >
            {kindLabel(criterion.kind)}
          </span>
          {criterion.kind === 'skor' ? (
            <span className="rounded-full border border-neutral-400 px-3 py-0.5 text-sm text-neutral-700">
              Bobot {criterion.weight ?? 0}%
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Naikkan ${criterion.name}`}
            disabled={index === 0 || moving}
            onClick={() => onMove(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Turunkan ${criterion.name}`}
            disabled={index >= total - 1 || moving}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
        </div>
      </div>

      {criterion.expectation ? (
        <p className="mt-2 max-h-10 overflow-hidden text-sm text-neutral-700">
          {criterion.expectation}
        </p>
      ) : null}

      {linked.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {linked.map((field) => {
            const label = richTextToPlain(field.label);
            return (
              <li key={field.id}>
                <span
                  title={label}
                  className="inline-block max-w-[14rem] truncate rounded-full bg-neutral-200 px-3 py-0.5 text-sm text-neutral-700"
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil /> Ubah
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger-dark hover:text-danger-dark"
          onClick={() => setConfirming(true)}
        >
          <Trash2 /> Hapus
        </Button>
      </div>

      {confirming ? (
        <div className="mt-2 grid gap-2 rounded-xl bg-danger-light p-3">
          <p className="text-sm text-danger-dark">
            Hapus kriteria ini? Penilaian yang sudah masuk ikut terhapus.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="dark_blue"
              size="sm"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Hapus
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function PenilaianPane() {
  const builder = useBuilder();
  const utils = api.useUtils();
  const oprecInfo = builder.detail?.oprec ?? null;
  const recruitmentId = oprecInfo?.recruitmentId ?? null;

  const list = api.oprec.criteriaList.useQuery(
    { recruitmentId: recruitmentId ?? '' },
    { enabled: recruitmentId !== null },
  );
  const overview = api.oprec.get.useQuery(
    { recruitmentId: recruitmentId ?? '' },
    { enabled: recruitmentId !== null },
  );
  const reorder = api.oprec.criteriaReorder.useMutation();
  const remove = api.oprec.criterionDelete.useMutation();

  const [slotScope, setSlotScope] = useState('umum');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Criterion | null>(null);
  const [criterionOpen, setCriterionOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const slots = list.data?.slots ?? [];
  const fields = list.data?.fields ?? [];
  const activeSlot =
    slots.find((slot) => slot.scope === slotScope) ?? slots[0] ?? null;
  const applicationCount = overview.data?.applicationCount ?? 0;
  const search = query.trim().toLowerCase();
  const visibleSlots =
    search === ''
      ? slots
      : slots.filter((slot) => slot.label.toLowerCase().includes(search));

  const refresh = () => {
    if (recruitmentId === null) return;
    void utils.oprec.criteriaList.invalidate({ recruitmentId });
  };

  const move = (slot: Slot, index: number, delta: number) => {
    if (recruitmentId === null) return;
    const target = index + delta;
    const ids = slot.criteria.map((item) => item.id);
    const current = ids[index];
    const swap = ids[target];
    if (current === undefined || swap === undefined) return;
    const next = [...ids];
    next[index] = swap;
    next[target] = current;
    reorder.mutate(
      { recruitmentId, scope: slot.scope, criterionIds: next },
      { onSuccess: refresh },
    );
  };

  const deleteCriterion = (criterionId: string) => {
    if (recruitmentId === null) return;
    remove.mutate({ recruitmentId, criterionId }, { onSuccess: refresh });
  };

  if (recruitmentId === null) {
    return (
      <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
        Formulir ini belum terikat ke oprec, jadi penilaian belum tersedia.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        {slots.length > 8 ? (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari bidang atau divisi"
              aria-label="Cari bidang atau divisi"
              className="pl-9"
            />
          </div>
        ) : null}

        <nav aria-label="Slot penilaian" className="grid gap-1">
          {visibleSlots.map((slot) => {
            const active = activeSlot?.scope === slot.scope;
            const hasSkor = slot.criteria.some((item) => item.kind === 'skor');
            const warn = hasSkor && slot.weightSum !== 100;
            return (
              <button
                key={slot.scope}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setSlotScope(slot.scope)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  active
                    ? 'bg-primary-200 text-primary-400'
                    : 'text-neutral-700 hover:bg-neutral-200',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {slot.label}
                </span>
                {warn ? (
                  <span
                    title="Total bobot belum 100%"
                    className="shrink-0 text-xs font-semibold text-warning-dark"
                  >
                    {slot.weightSum}%
                  </span>
                ) : null}
                <span
                  aria-label={`${slot.criteria.length} kriteria`}
                  className="shrink-0 text-xs text-neutral-700"
                >
                  {slot.criteria.length}
                </span>
              </button>
            );
          })}
          {visibleSlots.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-700">
              Tidak ada slot yang cocok.
            </p>
          ) : null}
        </nav>
      </div>

      <section className="grid content-start gap-3">
        {list.isLoading ? (
          <p className="text-sm text-neutral-700">Memuat kriteria…</p>
        ) : activeSlot === null ? (
          <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
            Belum ada slot penilaian.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h2 className="text-lg font-semibold text-neutral-1000">
                  {activeSlot.label}
                </h2>
                <WeightSummary slot={activeSlot} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="dark_blue"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setCriterionOpen(true);
                  }}
                >
                  <Plus /> Tambah kriteria
                </Button>
                <Button
                  type="button"
                  variant="dark_blue_outline"
                  size="sm"
                  onClick={() => setSheetOpen(true)}
                >
                  <FileSpreadsheet /> Ekspor / impor sheet
                </Button>
              </div>
            </div>

            {applicationCount > 0 ? (
              <p className="rounded-xl bg-warning-light p-3 text-sm text-warning-dark">
                Perubahan kriteria menghitung ulang status semua pendaftar.
              </p>
            ) : null}

            {remove.isError ? (
              <p role="alert" className="text-sm text-danger-dark">
                {remove.error.message}
              </p>
            ) : null}
            {reorder.isError ? (
              <p role="alert" className="text-sm text-danger-dark">
                {reorder.error.message}
              </p>
            ) : null}

            <ul className="grid gap-2">
              {activeSlot.criteria.length === 0 ? (
                <li className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
                  Belum ada kriteria di sini.
                </li>
              ) : (
                activeSlot.criteria.map((criterion, index) => (
                  <CriterionCard
                    key={criterion.id}
                    criterion={criterion}
                    index={index}
                    total={activeSlot.criteria.length}
                    fields={fields}
                    moving={reorder.isPending}
                    onMove={(delta) => move(activeSlot, index, delta)}
                    onEdit={() => {
                      setEditing(criterion);
                      setCriterionOpen(true);
                    }}
                    onDelete={() => deleteCriterion(criterion.id)}
                  />
                ))
              )}
            </ul>

            <CriterionDialog
              recruitmentId={recruitmentId}
              scope={activeSlot.scope}
              scopeLabel={activeSlot.label}
              criterion={editing}
              fields={fields}
              open={criterionOpen}
              onOpenChange={(open) => {
                setCriterionOpen(open);
                if (!open) setEditing(null);
              }}
              onSaved={() => {
                setCriterionOpen(false);
                setEditing(null);
                refresh();
              }}
            />
            <SheetDialog
              recruitmentId={recruitmentId}
              open={sheetOpen}
              onOpenChange={setSheetOpen}
            />
          </>
        )}
      </section>
    </div>
  );
}
