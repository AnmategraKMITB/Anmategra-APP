'use client';

import { Pencil, Plus } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { type RouterOutputs, api } from '~/trpc/react';

import { richTextToPlain } from '../rich-text';

type Data = RouterOutputs['oprec']['criteriaList'];
type Slot = Data['slots'][number];
type Criterion = Slot['criteria'][number];
type Field = Data['fields'][number];

type Pair = {
  key: string;
  slot: Slot;
  sectionId: string | null;
  title: string;
  fields: Field[];
};

function kindLabel(kind: string) {
  if (kind === 'skor') return 'Skor';
  if (kind === 'gugur_otomatis') return 'Gugur otomatis';
  return 'Gugur manual';
}

function kindClass(kind: string) {
  if (kind === 'skor') return 'bg-primary-100 text-primary-400';
  if (kind === 'gugur_otomatis') return 'bg-danger-light text-danger-dark';
  return 'bg-warning-light text-warning-dark';
}

/**
 * Kanvas bertali: tiap bagian form berdampingan dengan jalur kriteria.
 * Memilih kriteria lalu mengeklik pertanyaan menambah/menyambung ikatan.
 */
export function RopeCanvas({
  recruitmentId,
  slots,
  fields,
  sections,
  onChanged,
  onAddCriterion,
  onEditCriterion,
}: {
  recruitmentId: string;
  slots: Slot[];
  fields: Field[];
  sections: Data['sections'];
  onChanged: () => void;
  onAddCriterion: (slot: Slot) => void;
  onEditCriterion: (slot: Slot, criterion: Criterion) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const save = api.oprec.criterionSave.useMutation({
    onSuccess: onChanged,
  });

  const answerable = useMemo(
    () =>
      fields.filter(
        (field) => field.type !== 'text_block' && field.type !== 'unit_choice',
      ),
    [fields],
  );
  const fieldById = useMemo(
    () => new Map(answerable.map((field) => [field.id, field])),
    [answerable],
  );
  const fieldsBySection = useMemo(() => {
    const map = new Map<string, Field[]>();
    for (const field of answerable) {
      const key = field.sectionId ?? '';
      map.set(key, [...(map.get(key) ?? []), field]);
    }
    return map;
  }, [answerable]);

  const pairs = useMemo(() => {
    const list: Pair[] = [];
    for (const slot of slots) {
      const relevant = new Set<string>();
      // Pertanyaan yang belum masuk bagian mana pun tetap bisa diikat.
      if (slot.scope === 'umum' && (fieldsBySection.get('')?.length ?? 0) > 0) {
        relevant.add('');
      }
      for (const section of sections) {
        if (slot.scope === 'umum') {
          if (section.divisionIds.length === 0) relevant.add(section.id);
        } else if (section.divisionIds.includes(slot.scope)) {
          relevant.add(section.id);
        }
      }
      // Sertakan bagian yang sudah punya ikatan lama walau bidangnya lain.
      for (const criterion of slot.criteria) {
        for (const fieldId of criterion.fieldIds) {
          const sectionId = fieldById.get(fieldId)?.sectionId;
          if (sectionId) relevant.add(sectionId);
          else if (fieldById.has(fieldId)) relevant.add('');
        }
      }
      if (relevant.size === 0) {
        list.push({
          key: `${slot.scope}:kosong`,
          slot,
          sectionId: null,
          title: 'Belum ada bagian form untuk lingkup ini',
          fields: [],
        });
        continue;
      }
      for (const sectionId of relevant) {
        const section =
          sectionId === ''
            ? null
            : sections.find((row) => row.id === sectionId);
        list.push({
          key: `${slot.scope}:${sectionId}`,
          slot,
          sectionId,
          title:
            sectionId === ''
              ? 'Tanpa bagian'
              : (section?.title ?? 'Tanpa bagian'),
          fields: fieldsBySection.get(sectionId) ?? [],
        });
      }
    }
    return list;
  }, [slots, sections, fieldById, fieldsBySection]);

  const allCriteria = useMemo(
    () => slots.flatMap((slot) => slot.criteria.map((c) => ({ slot, c }))),
    [slots],
  );
  const selectedCriterion =
    allCriteria.find((entry) => entry.c.id === selectedId) ?? null;

  const toggle = (slot: Slot, criterion: Criterion, fieldId: string) => {
    if (save.isPending) return;
    const has = criterion.fieldIds.includes(fieldId);
    const fieldIds = has
      ? criterion.fieldIds.filter((id) => id !== fieldId)
      : [...criterion.fieldIds, fieldId];
    save.mutate({
      recruitmentId,
      criterionId: criterion.id,
      scope: slot.scope,
      name: criterion.name,
      kind: criterion.kind,
      weight: criterion.weight,
      expectation: criterion.expectation,
      gateRule: criterion.gateRule,
      fieldIds,
    });
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 rounded bg-primary-400" />
            Tali kriteria–pertanyaan
          </span>
          <span>{answerable.length} pertanyaan</span>
          <span>
            {allCriteria.reduce(
              (sum, entry) => sum + entry.c.fieldIds.length,
              0,
            )}{' '}
            ikatan
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-1000">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => setShowAll(event.target.checked)}
          />
          Tampilkan semua tali
        </label>
      </div>

      <p className="text-sm text-neutral-700" role="status">
        {selectedCriterion
          ? `Kriteria “${selectedCriterion.c.name}” dipilih. Klik pertanyaan di bagian form untuk menyambung atau melepas.`
          : 'Pilih satu kriteria di kanan, lalu klik pertanyaan di kiri untuk menyambung.'}
      </p>
      {save.isError ? (
        <p role="alert" className="text-sm text-danger-dark">
          {save.error.message}
        </p>
      ) : null}

      {pairs.length === 0 ? (
        <p className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 text-sm text-neutral-700">
          Belum ada bagian form atau kriteria untuk digambar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[24px] border border-neutral-400 bg-neutral-100">
          <div className="grid min-w-[760px] gap-6 p-4">
            {pairs.map((pair) => (
              <RopePair
                key={pair.key}
                pair={pair}
                selectedId={selectedId}
                showAll={showAll}
                onSelect={setSelectedId}
                onToggle={toggle}
                onAdd={onAddCriterion}
                onEdit={onEditCriterion}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RopePair({
  pair,
  selectedId,
  showAll,
  onSelect,
  onToggle,
  onAdd,
  onEdit,
}: {
  pair: Pair;
  selectedId: string | null;
  showAll: boolean;
  onSelect: (id: string | null) => void;
  onToggle: (slot: Slot, criterion: Criterion, fieldId: string) => void;
  onAdd: (slot: Slot) => void;
  onEdit: (slot: Slot, criterion: Criterion) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef(new Map<string, HTMLButtonElement>());
  const critRefs = useRef(new Map<string, HTMLButtonElement>());
  const [wires, setWires] = useState<
    { key: string; d: string; active: boolean }[]
  >([]);

  useLayoutEffect(() => {
    const compute = () => {
      const base = box.current?.getBoundingClientRect();
      if (!base) return;
      const next: { key: string; d: string; active: boolean }[] = [];
      for (const criterion of pair.slot.criteria) {
        if (!showAll && selectedId !== criterion.id) continue;
        const crit = critRefs.current.get(criterion.id);
        if (!crit) continue;
        const cr = crit.getBoundingClientRect();
        const x2 = cr.left - base.left;
        const y2 = cr.top + cr.height / 2 - base.top;
        for (const fieldId of criterion.fieldIds) {
          const field = fieldRefs.current.get(fieldId);
          if (!field) continue;
          const fr = field.getBoundingClientRect();
          const x1 = fr.right - base.left;
          const y1 = fr.top + fr.height / 2 - base.top;
          next.push({
            key: `${criterion.id}:${fieldId}`,
            d: `M ${x1} ${y1} C ${x1 + 48} ${y1}, ${x2 - 48} ${y2}, ${x2} ${y2}`,
            active: selectedId === criterion.id,
          });
        }
      }
      setWires(next);
    };

    compute();
    const observer = new ResizeObserver(compute);
    if (box.current) observer.observe(box.current);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [pair.slot.criteria, selectedId, showAll]);

  return (
    <div
      ref={box}
      className="relative grid grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)] gap-16"
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
      >
        {wires.map((wire) => (
          <path
            key={wire.key}
            d={wire.d}
            fill="none"
            className={cn(
              wire.active ? 'stroke-primary-400' : 'stroke-neutral-500',
            )}
            strokeWidth={wire.active ? 2.5 : 1.5}
            strokeOpacity={wire.active ? 1 : 0.45}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="grid content-start gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {pair.title}
        </h3>
        {pair.fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-400 p-3 text-sm text-neutral-700">
            Belum ada pertanyaan di bagian ini.
          </p>
        ) : (
          pair.fields.map((field) => {
            const selected = pair.slot.criteria.find(
              (criterion) => criterion.id === selectedId,
            );
            const linked = selected?.fieldIds.includes(field.id) ?? false;
            const count = pair.slot.criteria.filter((criterion) =>
              criterion.fieldIds.includes(field.id),
            ).length;
            return (
              <button
                key={field.id}
                ref={(element) => {
                  if (element) fieldRefs.current.set(field.id, element);
                  else fieldRefs.current.delete(field.id);
                }}
                type="button"
                aria-pressed={selected ? linked : undefined}
                onClick={() => {
                  if (selected) onToggle(pair.slot, selected, field.id);
                  else if (pair.slot.criteria[0]) {
                    onSelect(pair.slot.criteria[0].id);
                  }
                }}
                className={cn(
                  'relative z-20 grid gap-1 rounded-xl border bg-neutral-50 px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  linked
                    ? 'border-primary-400 bg-primary-100'
                    : 'border-neutral-400 hover:border-primary-300',
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-semibold text-neutral-1000">
                    {richTextToPlain(field.label)}
                  </span>
                  {count > 0 ? (
                    <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] text-neutral-700">
                      {count} kriteria
                    </span>
                  ) : null}
                  {field.archived ? (
                    <span className="text-[11px] text-neutral-700">
                      diarsipkan
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                  {field.type}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="grid content-start gap-2">
        <h3 className="text-right text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {pair.slot.label}
        </h3>
        {pair.slot.criteria.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-400 p-3 text-sm text-neutral-700">
            Belum ada kriteria di lingkup ini.
          </p>
        ) : (
          pair.slot.criteria.map((criterion) => {
            const selected = selectedId === criterion.id;
            return (
              <div key={criterion.id} className="flex items-stretch gap-1">
                <button
                  ref={(element) => {
                    if (element) critRefs.current.set(criterion.id, element);
                    else critRefs.current.delete(criterion.id);
                  }}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? null : criterion.id)}
                  className={cn(
                    'relative z-20 min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    selected
                      ? 'border-primary-400 bg-primary-100'
                      : 'border-neutral-400 bg-neutral-50 hover:border-primary-300',
                  )}
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold text-neutral-1000">
                      {criterion.name}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px]',
                        kindClass(criterion.kind),
                      )}
                    >
                      {kindLabel(criterion.kind)}
                    </span>
                    {criterion.kind === 'skor' ? (
                      <span className="text-[11px] text-neutral-700">
                        {criterion.weight ?? 0}%
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-neutral-700">
                    {criterion.fieldIds.length === 0
                      ? 'Belum terhubung'
                      : `${criterion.fieldIds.length} pertanyaan`}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Ubah ${criterion.name}`}
                  onClick={() => onEdit(pair.slot, criterion)}
                >
                  <Pencil />
                </Button>
              </div>
            );
          })
        )}
        <Button
          type="button"
          variant="dark_blue_outline"
          size="sm"
          className="justify-self-end"
          onClick={() => onAdd(pair.slot)}
        >
          <Plus /> Tambah kriteria
        </Button>
      </div>
    </div>
  );
}
