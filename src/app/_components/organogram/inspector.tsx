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
import { Textarea } from '~/components/ui/textarea';

import {
  type Draft,
  type EditorAction,
  MAX_DEPTH,
  MAX_TIER,
  NODE_WIDTH_DEFAULT,
  NODE_WIDTH_MAX,
  NODE_WIDTH_MIN,
  type PlacementsByPosition,
  type Unit,
  clampNodeWidth,
  descendantsOf,
  endIndexOfPositions,
  levelLabelFor,
  levelOf,
  pathOf,
  planPositionDrop,
  planUnitsDrop,
  planUnitsToRoot,
  selectionRoots,
  statsOf,
} from './model';
import { PositionRow, type PositionRowProps } from './position-row';

const ROOT_TARGET = '__root__';

/** Gabungan bagian dan seluruh turunannya. */
function subtreeIdsOf(units: Unit[], ids: readonly string[]): Set<string> {
  const all = new Set<string>();
  for (const id of ids) {
    for (const member of descendantsOf(units, id)) all.add(member);
  }
  return all;
}

export type InspectorProps = {
  draft: Draft;
  placements: PlacementsByPosition;
  selectedId: string | null;
  /** Seluruh pilihan; lebih dari satu bagian menampilkan panel aksi massal. */
  selectedIds: readonly string[];
  onSelect: (id: string | null) => void;
  onSelectIds: (ids: string[]) => void;
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
    selectedIds,
    onSelect,
    onSelectIds,
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

  // Nama bagian lengkap dengan induknya, untuk menu "Pindahkan ke bagian lain".
  const namePathOf = (id: string): string => {
    const names: string[] = [];
    let current = draft.units.find((item) => item.id === id);
    for (let depth = 0; current && depth < MAX_DEPTH; depth += 1) {
      names.unshift(current.name);
      const parentId: string | null = current.parentId;
      current = parentId
        ? draft.units.find((item) => item.id === parentId)
        : undefined;
    }
    return names.join(' › ');
  };
  const unitOptions =
    unit === null
      ? []
      : draft.units
          .filter((item) => item.id !== unit.id && canEditUnit(item.id))
          .map((item) => ({ id: item.id, label: namePathOf(item.id) }));

  const handleDropPosition = (
    draggedId: string,
    targetId: string,
    where: 'before' | 'after',
  ) => {
    const dragged = draft.positions.find((item) => item.id === draggedId);
    const plan = planPositionDrop(draft.positions, draggedId, targetId, where);
    if (!dragged || !plan) return;
    if (
      plan.unitId !== dragged.unitId &&
      !(canEditUnit(plan.unitId) && canEditUnit(dragged.unitId))
    ) {
      return;
    }
    dispatch({
      type: 'movePosition',
      id: draggedId,
      unitId: plan.unitId,
      index: plan.index,
    });
  };

  const handleMoveStep = (positionId: string, direction: -1 | 1) => {
    const at = positions.findIndex((item) => item.id === positionId);
    if (at < 0 || unit === null) return;
    dispatch({
      type: 'movePosition',
      id: positionId,
      unitId: unit.id,
      index: at + direction,
    });
  };

  const handleMoveToUnit = (positionId: string, unitId: string) => {
    dispatch({
      type: 'movePosition',
      id: positionId,
      unitId,
      index: endIndexOfPositions(draft.positions, unitId, positionId),
    });
  };

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
        <h2 className="line-clamp-2 break-words text-lg font-semibold text-neutral-1000">
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

        {!readOnly && selectedIds.length <= 1 ? (
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

        {selectedIds.length > 1 ? (
          <BulkPanel
            draft={draft}
            ids={selectedIds}
            readOnly={readOnly}
            canEditUnit={canEditUnit}
            canEditRoot={canEditRoot}
            namePathOf={namePathOf}
            dispatch={dispatch}
            onSelectIds={onSelectIds}
          />
        ) : unit === null ? (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>
              Tidak ada {level1Label.toLowerCase()} yang dipilih. Pilih satu di
              Struktur atau bagan untuk melihat dan mengubahnya.
            </p>
            <p>
              Tahan Ctrl atau Cmd lalu klik untuk memilih beberapa; di Struktur,
              Shift + klik memilih rentang, dan di bagan, Shift + seret ruang
              kosong memilih dengan kotak.
            </p>
          </div>
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

            <div className="space-y-1">
              <Label htmlFor={`unit-${unit.id}-description`}>
                Deskripsi kerja
              </Label>
              <Textarea
                id={`unit-${unit.id}-description`}
                value={unit.description ?? ''}
                maxLength={2000}
                rows={4}
                onChange={(event) =>
                  dispatch({
                    type: 'setUnitDescription',
                    id: unit.id,
                    description: event.target.value,
                  })
                }
                placeholder={`Apa yang dikerjakan ${levelLabelFor(unitDepth, draft.levelLabels).toLowerCase()} ini`}
                disabled={!unitEditable}
                className="rounded-[8px] border-neutral-400 text-sm text-neutral-1000"
              />
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
                    value={
                      unit.layout.tier === undefined
                        ? 'depth'
                        : String(unit.layout.tier)
                    }
                    onValueChange={(value) =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: {
                          tier:
                            value === 'depth' ? undefined : Number(value),
                        },
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
                      <SelectItem value="depth">
                        Ikut kedalaman ({unitDepth})
                      </SelectItem>
                      {Array.from({ length: MAX_TIER }, (_, index) => index + 1).map(
                        (tier) => (
                          <SelectItem key={tier} value={String(tier)}>
                            Tier {tier}
                          </SelectItem>
                        ),
                      )}
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
                <div className="space-y-1">
                  <Label htmlFor={`unit-${unit.id}-label`}>
                    Jenis unit di depan nama
                  </Label>
                  <Select
                    value={
                      unit.layout.showLabel === undefined
                        ? 'inherit'
                        : String(unit.layout.showLabel)
                    }
                    onValueChange={(value) =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: {
                          showLabel:
                            value === 'inherit' ? undefined : value === 'true',
                        },
                      })
                    }
                    disabled={!unitEditable}
                  >
                    <SelectTrigger
                      id={`unit-${unit.id}-label`}
                      className="rounded-[8px] border-neutral-400"
                    >
                      <SelectValue placeholder="Ikut sakelar bagan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">
                        Ikut sakelar bagan
                      </SelectItem>
                      <SelectItem value="true">Tulis jenisnya</SelectItem>
                      <SelectItem value="false">Jangan tulis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(unit.layout.childrenMode ?? 'hanging') === 'side' ? (
                  <div className="space-y-1">
                    <Label htmlFor={`unit-${unit.id}-even`}>
                      Tinggi kotak anak
                    </Label>
                    <Select
                      value={
                        unit.layout.evenRows === undefined
                          ? 'inherit'
                          : String(unit.layout.evenRows)
                      }
                      onValueChange={(value) =>
                        dispatch({
                          type: 'setUnitLayout',
                          id: unit.id,
                          patch: {
                            evenRows:
                              value === 'inherit'
                                ? undefined
                                : value === 'true',
                          },
                        })
                      }
                      disabled={!unitEditable}
                    >
                      <SelectTrigger
                        id={`unit-${unit.id}-even`}
                        className="rounded-[8px] border-neutral-400"
                      >
                        <SelectValue placeholder="Ikut sakelar bagan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">
                          Ikut sakelar bagan
                        </SelectItem>
                        <SelectItem value="true">
                          Selalu samakan
                        </SelectItem>
                        <SelectItem value="false">
                          Ikuti isinya
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label htmlFor={`unit-${unit.id}-side`}>
                    Posisi terhadap sumbu
                  </Label>
                  <Select
                    value={unit.layout.side ?? 'auto'}
                    onValueChange={(value) =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: {
                          side:
                            value === 'auto'
                              ? undefined
                              : (value as 'left' | 'right' | 'center'),
                        },
                      })
                    }
                    disabled={!unitEditable}
                  >
                    <SelectTrigger
                      id={`unit-${unit.id}-side`}
                      className="rounded-[8px] border-neutral-400"
                    >
                      <SelectValue placeholder="Otomatis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Otomatis — kiri dan kanan bergantian
                      </SelectItem>
                      <SelectItem value="left">Kiri sumbu</SelectItem>
                      <SelectItem value="right">Kanan sumbu</SelectItem>
                      <SelectItem value="center">Tengah sumbu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`unit-${unit.id}-width`}>Lebar kartu</Label>
                <div className="flex items-center gap-2">
                  <Input
                    key={`${unit.id}-${unit.layout.width ?? 'default'}`}
                    id={`unit-${unit.id}-width`}
                    type="number"
                    inputMode="numeric"
                    min={NODE_WIDTH_MIN}
                    max={NODE_WIDTH_MAX}
                    step={8}
                    defaultValue={unit.layout.width ?? NODE_WIDTH_DEFAULT}
                    disabled={!unitEditable}
                    aria-describedby={`unit-${unit.id}-width-hint`}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (
                        event.target.value === '' ||
                        !Number.isFinite(value)
                      ) {
                        event.target.value = String(
                          unit.layout.width ?? NODE_WIDTH_DEFAULT,
                        );
                        return;
                      }
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: { width: clampNodeWidth(value) },
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    className="h-9 rounded-[8px] border-neutral-400 text-sm tabular-nums text-neutral-1000"
                  />
                  <Button
                    variant="dark_blue_outline"
                    size="sm"
                    disabled={!unitEditable || unit.layout.width === undefined}
                    onClick={() =>
                      dispatch({
                        type: 'setUnitLayout',
                        id: unit.id,
                        patch: { width: undefined },
                      })
                    }
                  >
                    Bawaan
                  </Button>
                </div>
                <p
                  id={`unit-${unit.id}-width-hint`}
                  className="text-xs text-neutral-700"
                >
                  {NODE_WIDTH_MIN} sampai {NODE_WIDTH_MAX} px. Nama yang lebih
                  panjang turun ke baris berikutnya. Di bagan, seret tepi kanan
                  kartu yang dipilih.
                </p>
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
                  {positions.map((position, positionIndex) => (
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
                      onDropPosition={handleDropPosition}
                      onMoveStep={handleMoveStep}
                      canMoveUp={positionIndex > 0}
                      canMoveDown={positionIndex < positions.length - 1}
                      unitOptions={unitOptions}
                      onMoveToUnit={handleMoveToUnit}
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

/** Aksi massal untuk beberapa bagian yang dipilih; setiap aksi satu langkah urungkan. */
function BulkPanel(props: {
  draft: Draft;
  ids: readonly string[];
  readOnly: boolean;
  canEditUnit: (unitId: string) => boolean;
  canEditRoot: boolean;
  namePathOf: (id: string) => string;
  dispatch: (action: EditorAction) => void;
  onSelectIds: (ids: string[]) => void;
}): JSX.Element {
  const {
    draft,
    ids,
    readOnly,
    canEditUnit,
    canEditRoot,
    namePathOf,
    dispatch,
    onSelectIds,
  } = props;
  const [confirming, setConfirming] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const roots = selectionRoots(draft.units, ids);
  const units = ids
    .map((id) => draft.units.find((unit) => unit.id === id))
    .filter((unit): unit is Unit => unit !== undefined);
  const editable = !readOnly && units.every((unit) => canEditUnit(unit.id));
  const hiddenCount = units.filter(
    (unit) => unit.layout.hidden === true,
  ).length;
  const removedCount = Math.max(
    0,
    subtreeIdsOf(
      draft.units,
      roots.map((unit) => unit.id),
    ).size - roots.length,
  );

  // Tujuan pemindahan: bagian di luar pilihan (dan turunannya) yang boleh diubah.
  const inMoved = subtreeIdsOf(
    draft.units,
    roots.map((unit) => unit.id),
  );
  const targets = draft.units.filter(
    (unit) => !inMoved.has(unit.id) && canEditUnit(unit.id),
  );

  const moveTo = (value: string) => {
    setMoveError(null);
    const plan =
      value === ROOT_TARGET
        ? planUnitsToRoot(draft.units, ids)
        : planUnitsDrop(draft.units, ids, value, 'inside');
    if (!plan.ok) {
      setMoveError(plan.reason);
      return;
    }
    if (plan.parentId === null && !canEditRoot) {
      setMoveError('Anda tidak berhak mengubah tingkat teratas.');
      return;
    }
    dispatch({
      type: 'moveUnits',
      ids: plan.ids,
      parentId: plan.parentId,
      index: plan.index,
    });
  };

  const shown = units.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-1000">
          {units.length} bagian dipilih
        </h3>
        <ul className="space-y-0.5 text-sm text-neutral-700">
          {shown.map((unit) => (
            <li key={unit.id} className="truncate">
              {unit.name}
            </li>
          ))}
          {units.length > shown.length ? (
            <li>dan {units.length - shown.length} lainnya</li>
          ) : null}
        </ul>
        <Button
          variant="dark_blue_outline"
          size="sm"
          onClick={() => onSelectIds([])}
        >
          Kosongkan pilihan
        </Button>
      </section>

      {!editable ? (
        <p className="text-sm text-neutral-700">
          Anda tidak berhak mengubah sebagian bagian yang dipilih.
        </p>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-1000">
              Tampilan di bagan
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="dark_blue_outline"
                size="sm"
                disabled={hiddenCount === units.length}
                onClick={() =>
                  dispatch({
                    type: 'setUnitsLayout',
                    ids: [...ids],
                    patch: { hidden: true },
                  })
                }
              >
                <EyeOff className="size-4" />
                Sembunyikan
              </Button>
              <Button
                variant="dark_blue_outline"
                size="sm"
                disabled={hiddenCount === 0}
                onClick={() =>
                  dispatch({
                    type: 'setUnitsLayout',
                    ids: [...ids],
                    patch: { hidden: false },
                  })
                }
              >
                <Eye className="size-4" />
                Tampilkan
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="bulk-move">Pindahkan ke</Label>
            <Select value="" onValueChange={moveTo}>
              <SelectTrigger
                id="bulk-move"
                className="rounded-[8px] border-neutral-400"
              >
                <SelectValue placeholder="Pilih bagian tujuan" />
              </SelectTrigger>
              <SelectContent>
                {canEditRoot ? (
                  <SelectItem value={ROOT_TARGET}>
                    Jadikan tingkat teratas
                  </SelectItem>
                ) : null}
                {targets.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {namePathOf(unit.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {moveError !== null ? (
              <p role="alert" className="text-sm text-danger-dark">
                {moveError}
              </p>
            ) : null}
          </section>

          <section className="rounded-[20px] bg-danger-light p-4">
            <h3 className="text-sm font-semibold text-danger-dark">
              Zona Bahaya
            </h3>
            <p className="mt-1 text-xs text-danger-dark">
              Menghapus {roots.length} bagian ini juga menghapus {removedCount}{' '}
              sub-bagian beserta seluruh jabatannya.
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
                      dispatch({ type: 'deleteUnits', ids: [...ids] });
                      onSelectIds([]);
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
                Hapus {units.length} bagian
              </Button>
            )}
          </section>
        </>
      )}
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
