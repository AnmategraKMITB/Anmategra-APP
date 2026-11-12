'use client';

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { JSX } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
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
import { cn } from '~/lib/utils';

import {
  type Draft,
  type EditorAction,
  type Person,
  type Position,
  type PositionKind,
  effectiveRanks,
  filledOfQuota,
} from './model';
import { PersonPicker } from './person-picker';
import {
  draggedPositionId,
  endPositionDrag,
  isPositionDrag,
  startPositionDrag,
} from './position-dnd';
import type { PlacementResult } from './use-organogram-editor';

export type PositionRowProps = {
  position: Position;
  draft: Draft;
  people: Person[];
  persisted: boolean;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  dispatch: (a: EditorAction) => void;
  onAddPerson: (
    positionId: string,
    userId: string,
    allowOverQuota?: boolean,
  ) => Promise<PlacementResult>;
  onRemovePerson: (placementId: string) => Promise<PlacementResult>;
  /** Jabatan lain dilepas di atas atau di bawah jabatan ini. */
  onDropPosition: (
    draggedId: string,
    targetId: string,
    where: 'before' | 'after',
  ) => void;
  /** Pengganti papan ketik untuk seretan: geser satu langkah dalam bagian. */
  onMoveStep: (positionId: string, direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Bagian lain yang boleh dituju lewat menu "Pindahkan ke bagian". */
  unitOptions: { id: string; label: string }[];
  onMoveToUnit: (positionId: string, unitId: string) => void;
};

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== '');
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials === '' ? '?' : initials;
}

export function PositionRow(props: PositionRowProps): JSX.Element {
  const {
    position,
    draft,
    people,
    persisted,
    editable,
    expanded,
    onToggle,
    dispatch,
    onAddPerson,
    onRemovePerson,
    onDropPosition,
    onMoveStep,
    canMoveUp,
    canMoveDown,
    unitOptions,
    onMoveToUnit,
  } = props;

  const rowRef = useRef<HTMLDivElement | null>(null);
  const [dropWhere, setDropWhere] = useState<'before' | 'after' | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingOverQuota, setPendingOverQuota] = useState<{
    userId: string;
    name: string;
    count: number;
    quota: number;
  } | null>(null);

  const { filled, quota } = filledOfQuota(position, {
    [position.id]: people,
  });

  let fillClass = 'text-neutral-700';
  if (quota > 0 && filled >= quota) {
    fillClass = 'text-success-dark';
  } else if (quota > 0 && filled === 0) {
    fillClass = 'text-neutral-1000';
  }

  const fillLabel = quota === 0 ? `${filled} orang` : `${filled}/${quota}`;
  const excludeUserIds = new Set(people.map((person) => person.userId));

  let pickerDisabledReason: string | undefined;
  if (!persisted) {
    pickerDisabledReason = 'Simpan dulu untuk menempatkan orang.';
  } else if (!editable) {
    pickerDisabledReason = 'Anda tidak berhak mengubah penempatan di sini.';
  }

  const handlePick = async (user: { userId: string; name: string }) => {
    setAddError(null);
    setPendingOverQuota(null);
    setAdding(true);
    const result = await onAddPerson(position.id, user.userId);
    setAdding(false);
    if (!result.ok) {
      if (result.kind === 'quota_full') {
        setPendingOverQuota({
          userId: user.userId,
          name: user.name,
          count: result.count,
          quota: result.quota,
        });
      } else {
        setAddError(result.message);
      }
    }
  };

  const handleConfirmOverQuota = async () => {
    if (pendingOverQuota === null) return;
    setAdding(true);
    setAddError(null);
    const result = await onAddPerson(
      position.id,
      pendingOverQuota.userId,
      true,
    );
    setAdding(false);
    if (result.ok) {
      setPendingOverQuota(null);
    } else if (result.kind === 'error') {
      setAddError(result.message);
    } else {
      setPendingOverQuota({
        ...pendingOverQuota,
        count: result.count,
        quota: result.quota,
      });
    }
  };

  const handleRemove = async (person: Person) => {
    setRemovingId(person.id);
    setRemoveError(null);
    const result = await onRemovePerson(person.id);
    if (!result.ok && result.kind === 'error') {
      setRemoveError(result.message);
    }
    setRemovingId(null);
  };

  const handleConfirmDelete = () => {
    dispatch({ type: 'deletePosition', id: position.id });
    setConfirmingDelete(false);
  };

  const whereOf = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        'border-b border-neutral-200',
        dropWhere === 'before' && 'border-t-2 border-t-primary-400',
        dropWhere === 'after' && 'border-b-2 border-b-primary-400',
      )}
      onDragOver={(event) => {
        if (!editable || !isPositionDrag(event)) return;
        if (draggedPositionId() === position.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropWhere(whereOf(event));
      }}
      onDragLeave={() => setDropWhere(null)}
      onDrop={(event) => {
        const where = dropWhere ?? whereOf(event);
        setDropWhere(null);
        const draggedId = draggedPositionId(event);
        if (!editable || draggedId === null || draggedId === position.id)
          return;
        event.preventDefault();
        onDropPosition(draggedId, position.id, where);
      }}
    >
      {confirmingDelete && editable ? (
        <div className="rounded-[8px] bg-danger-light px-3 py-2">
          <p className="text-sm font-medium text-danger-dark">
            Hapus jabatan ini?
          </p>
          {people.length > 0 ? (
            <p className="mt-1 text-xs text-danger-dark">
              Ada {people.length} orang di jabatan ini; penghapusan ditolak saat
              disimpan sampai penempatannya dipindahkan.
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button variant="warning" size="sm" onClick={handleConfirmDelete}>
              Hapus
            </Button>
            <Button
              variant="dark_blue_outline"
              size="sm"
              onClick={() => setConfirmingDelete(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-11 items-center gap-1 px-1 py-1">
          {editable ? (
            <button
              type="button"
              draggable
              onDragStart={(event) =>
                startPositionDrag(event, position.id, rowRef.current)
              }
              onDragEnd={endPositionDrag}
              aria-label={`Seret jabatan ${position.title}`}
              title="Seret untuk mengubah urutan atau memindahkan ke bagian lain"
              className="grid size-6 shrink-0 cursor-grab place-items-center rounded-[8px] text-neutral-500 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? 'Tutup pengaturan' : 'Pengaturan lanjut'}
            aria-label={
              expanded
                ? `Tutup pengaturan jabatan ${position.title}`
                : `Pengaturan lanjut jabatan ${position.title}`
            }
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
          {editable ? (
            <div className="flex-1">
              <Input
                value={position.title}
                onChange={(event) =>
                  dispatch({
                    type: 'updatePosition',
                    id: position.id,
                    patch: { title: event.target.value },
                  })
                }
                className="h-8 rounded-[8px] border-neutral-400 text-sm text-neutral-1000"
                aria-label={`Nama jabatan ${position.title}`}
              />
            </div>
          ) : (
            <span className="flex-1 text-sm font-semibold text-neutral-1000">
              {position.title}
            </span>
          )}
          <span className={`text-xs font-semibold tabular-nums ${fillClass}`}>
            {fillLabel}
          </span>
          {editable ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={position.hidden}
                aria-label={
                  position.hidden
                    ? 'Tampilkan di bagan'
                    : 'Sembunyikan dari bagan'
                }
                onClick={() =>
                  dispatch({
                    type: 'updatePosition',
                    id: position.id,
                    patch: { hidden: !position.hidden },
                  })
                }
              >
                {position.hidden ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Hapus jabatan ${position.title}`}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      )}

      {expanded ? (
        <div className="ml-6 space-y-3 border-l border-neutral-200 py-3 pl-3">
          {editable ? (
            <div className="space-y-1">
              <span className="text-sm font-medium text-neutral-1000">
                Urutan dan bagian
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="dark_blue_outline"
                  size="sm"
                  disabled={!canMoveUp}
                  aria-label={`Naikkan jabatan ${position.title}`}
                  onClick={() => onMoveStep(position.id, -1)}
                >
                  <ChevronUp className="size-4" />
                  Naik
                </Button>
                <Button
                  variant="dark_blue_outline"
                  size="sm"
                  disabled={!canMoveDown}
                  aria-label={`Turunkan jabatan ${position.title}`}
                  onClick={() => onMoveStep(position.id, 1)}
                >
                  <ChevronDown className="size-4" />
                  Turun
                </Button>
              </div>
              {unitOptions.length > 0 ? (
                <Select
                  value=""
                  onValueChange={(unitId) => onMoveToUnit(position.id, unitId)}
                >
                  <SelectTrigger
                    aria-label={`Pindahkan jabatan ${position.title} ke bagian lain`}
                    className="rounded-[8px] border-neutral-400"
                  >
                    <SelectValue placeholder="Pindahkan ke bagian lain" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`${position.id}-rank`}>Rank</Label>
              <Select
                value={position.rank}
                onValueChange={(value) =>
                  dispatch({
                    type: 'updatePosition',
                    id: position.id,
                    patch: { rank: value },
                  })
                }
                disabled={!editable}
              >
                <SelectTrigger
                  id={`${position.id}-rank`}
                  className="rounded-[8px] border-neutral-400"
                >
                  <SelectValue placeholder="Pilih rank" />
                </SelectTrigger>
                <SelectContent>
                  {effectiveRanks(draft.ranks).map((rank) => (
                    <SelectItem key={rank.id} value={rank.id}>
                      {rank.label}
                    </SelectItem>
                  ))}
                  {effectiveRanks(draft.ranks).every(
                    (rank) => rank.id !== position.rank,
                  ) ? (
                    <SelectItem value={position.rank}>
                      {position.rank}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${position.id}-kind`}>Jenis</Label>
              <Select
                value={position.kind}
                onValueChange={(value) =>
                  dispatch({
                    type: 'updatePosition',
                    id: position.id,
                    patch: { kind: value as PositionKind },
                  })
                }
                disabled={!editable}
              >
                <SelectTrigger
                  id={`${position.id}-kind`}
                  className="rounded-[8px] border-neutral-400"
                >
                  <SelectValue placeholder="Pilih jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="struktural">Struktural</SelectItem>
                  <SelectItem value="nonstruktural">Nonstruktural</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`${position.id}-quota`}>Kuota</Label>
            <Input
              id={`${position.id}-quota`}
              type="number"
              min={0}
              inputMode="numeric"
              value={position.quota}
              onChange={(event) => {
                const next = Number(event.target.value);
                dispatch({
                  type: 'updatePosition',
                  id: position.id,
                  patch: { quota: Number.isFinite(next) ? next : 0 },
                });
              }}
              disabled={!editable}
              className="h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000"
            />
            <p className="text-xs text-neutral-700">0 = tanpa batas</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-neutral-1000">Orang</p>
            <div className="space-y-1">
              {people.map((person) => {
                const name = person.name ?? 'Tanpa nama';
                const isRemoving = removingId === person.id;
                return (
                  <div
                    key={person.id}
                    className="flex items-center gap-2 rounded-full bg-neutral-200 py-1 pl-1 pr-2"
                  >
                    <Avatar className="size-6 border-neutral-400">
                      {person.image ? (
                        <AvatarImage src={person.image} alt={name} />
                      ) : null}
                      <AvatarFallback className="bg-primary-200 text-xs font-semibold text-primary-400">
                        {initialsOf(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-neutral-1000">{name}</span>
                    {person.source === 'closerec' ? (
                      <span className="text-xs text-neutral-700">closerec</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`Keluarkan ${name}`}
                      aria-busy={isRemoving}
                      disabled={isRemoving || !editable}
                      onClick={() => void handleRemove(person)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            {removeError ? (
              <p className="text-xs text-danger-dark">{removeError}</p>
            ) : null}
          </div>

          <PersonPicker
            disabled={pickerDisabledReason !== undefined}
            disabledReason={pickerDisabledReason}
            excludeUserIds={excludeUserIds}
            onPick={handlePick}
            busy={adding}
          />

          {pendingOverQuota ? (
            <div className="rounded-[8px] bg-warning-light px-3 py-2">
              <p className="text-xs text-neutral-1000">
                Penuh ({pendingOverQuota.count}/{pendingOverQuota.quota}). Tetap
                tambahkan {pendingOverQuota.name}?
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="light_blue"
                  size="sm"
                  onClick={() => void handleConfirmOverQuota()}
                  disabled={adding}
                >
                  Tetap tambahkan
                </Button>
                <Button
                  variant="dark_blue_outline"
                  size="sm"
                  onClick={() => setPendingOverQuota(null)}
                  disabled={adding}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : null}

          {addError ? (
            <p className="text-xs text-danger-dark">{addError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
