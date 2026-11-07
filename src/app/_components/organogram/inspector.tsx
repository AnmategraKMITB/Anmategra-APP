'use client';

import { Eye, EyeOff, Plus } from 'lucide-react';
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

import {
  type Draft,
  type EditorAction,
  MAX_DEPTH,
  type PlacementsByPosition,
  type Unit,
  descendantsOf,
  levelLabelFor,
  levelOf,
  pathOf,
  statsOf,
} from './model';
import { PositionRow, type PositionRowProps } from './position-row';

export type InspectorProps = {
  draft: Draft;
  placements: PlacementsByPosition;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: (a: EditorAction) => void;
  readOnly: boolean;
  canEditUnit: (unitId: string) => boolean;
  canEditRoot: boolean;
  persistedPositionIds: ReadonlySet<string>;
  newId: () => string;
  onAddPerson: PositionRowProps['onAddPerson'];
  onRemovePerson: PositionRowProps['onRemovePerson'];
};

export function Inspector(props: InspectorProps): JSX.Element {
  const {
    draft,
    placements,
    selectedId,
    onSelect,
    dispatch,
    readOnly,
    canEditUnit,
    canEditRoot,
    persistedPositionIds,
    newId,
    onAddPerson,
    onRemovePerson,
  } = props;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const stats = statsOf(draft);
  const level1Label = levelLabelFor(1, draft.levelLabels);
  const level2Label = levelLabelFor(2, draft.levelLabels);
  const level1Count = stats.levelCounts[0] ?? 0;
  const level2Count = stats.levelCounts[1];

  const unit =
    selectedId === null
      ? null
      : (draft.units.find((item) => item.id === selectedId) ?? null);
  const unitDepth = unit === null ? 0 : levelOf(draft.units, unit.id);
  const unitEditable = unit !== null && !readOnly && canEditUnit(unit.id);

  const positions =
    unit === null
      ? []
      : draft.positions
          .filter((position) => position.unitId === unit.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

  const targetDepth = unit === null ? 1 : unitDepth + 1;
  const targetLevelLabel = levelLabelFor(targetDepth, draft.levelLabels);
  const canAdd = unit === null ? canEditRoot && !readOnly : unitEditable;

  let addDisabledReason: string | undefined;
  if (!canAdd) {
    addDisabledReason =
      unit === null
        ? 'Anda tidak berhak menambah di tingkat teratas.'
        : 'Anda tidak berhak menambah di bawah bagian ini.';
  } else if (targetDepth > MAX_DEPTH) {
    addDisabledReason = `Kedalaman maksimum ${MAX_DEPTH} tingkat.`;
  }
  const addDisabled = addDisabledReason !== undefined;

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddUnit = () => {
    const id = newId();
    dispatch({ type: 'addUnit', id, parentId: unit?.id ?? null });
    onSelect(id);
  };

  const handleAddPosition = () => {
    if (unit === null) return;
    const id = newId();
    dispatch({ type: 'addPosition', id, unitId: unit.id });
    setExpandedIds((prev) => new Set(prev).add(id));
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-neutral-400 bg-neutral-50">
      <div className="p-4 pb-0">
        <h2 className="truncate text-lg font-semibold text-neutral-1000">
          {draft.name}
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <StatBlock value={level1Count} label={level1Label} />
          {level2Count !== undefined ? (
            <StatBlock value={level2Count} label={level2Label} />
          ) : null}
          <StatBlock value={stats.positionCount} label="Jabatan" />
          <StatBlock value={stats.depth} label="Kedalaman" />
        </div>

        {!readOnly ? (
          <Button
            variant="light_blue"
            className="w-full"
            onClick={handleAddUnit}
            disabled={addDisabled}
            title={addDisabledReason}
          >
            <Plus className="size-4" />
            Tambah {targetLevelLabel}
          </Button>
        ) : null}

        {unit === null ? (
          <p className="text-sm text-neutral-700">
            Pilih satu {level1Label.toLowerCase()} di Struktur atau bagan untuk
            melihat dan mengubahnya.
          </p>
        ) : (
          <div className="space-y-4">
            <UnitNameField
              key={`name-${unit.id}`}
              unit={unit}
              depth={unitDepth}
              levelLabels={draft.levelLabels}
              disabled={!unitEditable}
              dispatch={dispatch}
            />

            <div className="space-y-1">
              <Label htmlFor={`unit-${unit.id}-type`}>Sebutan</Label>
              <Input
                id={`unit-${unit.id}-type`}
                value={unit.typeLabel ?? ''}
                onChange={(event) =>
                  dispatch({
                    type: 'setUnitType',
                    id: unit.id,
                    typeLabel: event.target.value,
                  })
                }
                placeholder={levelLabelFor(unitDepth, draft.levelLabels)}
                disabled={!unitEditable}
                className="h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000"
              />
              <p className="text-xs text-neutral-700">
                Dipakai sebagai label kecil di atas nama. Kosongkan untuk
                memakai nama level.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-neutral-700">Path</span>
              <span className="tabular-nums text-neutral-700">
                {pathOf(draft.units, unit.id)}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-semibold text-primary-400">
                Tampilan di bagan
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`unit-${unit.id}-tier`}>Tier</Label>
                  <Select
                    value={unit.layout.tier ?? 'depth'}
                    onValueChange={(value) =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: { tier: value as 'depth' | 'manual' },
                      })
                    }
                    disabled={!unitEditable}
                  >
                    <SelectTrigger
                      id={`unit-${unit.id}-tier`}
                      className="rounded-[8px] border-neutral-400"
                    >
                      <SelectValue placeholder="Pilih tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="depth">Ikut kedalaman</SelectItem>
                      <SelectItem value="manual">Atur sendiri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`unit-${unit.id}-children`}>
                    Susunan anak
                  </Label>
                  <Select
                    value={unit.layout.childrenMode ?? 'hanging'}
                    onValueChange={(value) =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: { childrenMode: value as 'hanging' | 'side' },
                      })
                    }
                    disabled={!unitEditable}
                  >
                    <SelectTrigger
                      id={`unit-${unit.id}-children`}
                      className="rounded-[8px] border-neutral-400"
                    >
                      <SelectValue placeholder="Pilih susunan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hanging">Menggantung</SelectItem>
                      <SelectItem value="side">Berjajar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant={
                  unit.layout.hidden === true
                    ? 'dark_blue_outline'
                    : 'warning_outline'
                }
                size="sm"
                className="w-full"
                onClick={() =>
                  dispatch({
                    type: 'setUnitLayout',
                    id: unit.id,
                    patch: { hidden: unit.layout.hidden !== true },
                  })
                }
                disabled={!unitEditable}
              >
                {unit.layout.hidden === true ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
                {unit.layout.hidden === true
                  ? 'Tampilkan di bagan'
                  : 'Sembunyikan dari bagan'}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-primary-400">
                  Jabatan ({positions.length})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddPosition}
                  disabled={!unitEditable}
                >
                  <Plus className="size-4" />
                  Tambah
                </Button>
              </div>
              {positions.length === 0 ? (
                <p className="text-sm text-neutral-700">
                  Belum ada jabatan di{' '}
                  {levelLabelFor(unitDepth, draft.levelLabels).toLowerCase()}{' '}
                  ini.
                </p>
              ) : (
                <div>
                  {positions.map((position) => (
                    <PositionRow
                      key={position.id}
                      position={position}
                      draft={draft}
                      people={placements[position.id] ?? []}
                      persisted={persistedPositionIds.has(position.id)}
                      editable={unitEditable}
                      expanded={expandedIds.has(position.id)}
                      onToggle={() => toggleExpanded(position.id)}
                      dispatch={dispatch}
                      onAddPerson={onAddPerson}
                      onRemovePerson={onRemovePerson}
                    />
                  ))}
                </div>
              )}
            </div>

            {unitEditable ? (
              <DangerZone
                key={`danger-${unit.id}`}
                unit={unit}
                depth={unitDepth}
                levelLabels={draft.levelLabels}
                units={draft.units}
                dispatch={dispatch}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  value,
  label,
}: {
  value: number;
  label: string;
}): JSX.Element {
  return (
    <div className="rounded-[8px] bg-neutral-100 px-2 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-primary-400">
        {value}
      </p>
      <p className="text-xs text-neutral-700">{label}</p>
    </div>
  );
}

/**
 * Nama selalu mengikuti draf (sumber kebenaran). Teks lokal hanya ada selama
 * kolom sedang diedit, supaya mengosongkan kolom sementara tidak mengganti nama
 * dengan string kosong, dan perubahan nama dari tempat lain tidak tertinggal.
 */
function UnitNameField(props: {
  unit: Unit;
  depth: number;
  levelLabels: string[] | null;
  disabled: boolean;
  dispatch: (action: EditorAction) => void;
}): JSX.Element {
  const { unit, depth, levelLabels, disabled, dispatch } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const label = levelLabelFor(depth, levelLabels);

  return (
    <div className="space-y-1">
      <Label htmlFor={`unit-${unit.id}-name`}>Nama {label}</Label>
      <Input
        id={`unit-${unit.id}-name`}
        value={editing ?? unit.name}
        onChange={(event) => {
          const next = event.target.value;
          setEditing(next);
          if (next.trim() !== '') {
            dispatch({ type: 'renameUnit', id: unit.id, name: next });
          }
        }}
        onBlur={() => setEditing(null)}
        disabled={disabled}
        className="h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000"
      />
    </div>
  );
}

function DangerZone(props: {
  unit: Unit;
  depth: number;
  levelLabels: string[] | null;
  units: Unit[];
  dispatch: (action: EditorAction) => void;
  onSelect: (id: string | null) => void;
}): JSX.Element {
  const { unit, depth, levelLabels, units, dispatch, onSelect } = props;
  const [confirming, setConfirming] = useState(false);
  const label = levelLabelFor(depth, levelLabels);
  const count = Math.max(0, descendantsOf(units, unit.id).size - 1);

  return (
    <section className="rounded-[20px] bg-danger-light p-4">
      <h3 className="text-sm font-semibold text-danger-dark">Zona Bahaya</h3>
      <p className="mt-1 text-xs text-danger-dark">
        Menghapus {label.toLowerCase()} ini juga menghapus {count} sub-bagian
        beserta seluruh jabatannya.
      </p>
      {confirming ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-danger-dark">
            Yakin? Penghapusan baru berlaku setelah Simpan.
          </p>
          <div className="flex gap-2">
            <Button
              variant="warning"
              size="sm"
              onClick={() => {
                dispatch({ type: 'deleteUnit', id: unit.id });
                onSelect(unit.parentId);
              }}
            >
              Ya, hapus
            </Button>
            <Button
              variant="dark_blue_outline"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="warning"
          size="sm"
          className="mt-3"
          onClick={() => setConfirming(true)}
        >
          Hapus {label}
        </Button>
      )}
    </section>
  );
}
