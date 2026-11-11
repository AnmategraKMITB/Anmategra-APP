'use client';

import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';

import {
  DEFAULT_RANKS,
  type Draft,
  type EditorAction,
  MAX_DEPTH,
  MAX_RANKS,
  MAX_RANK_LABEL,
  type RankDef,
  effectiveRanks,
  levelLabelFor,
  levelOf,
  maxDepth,
  newRankId,
} from './model';

export type SettingsViewProps = {
  draft: Draft;
  dispatch: (a: EditorAction) => void;
  canManage: boolean;
  editLocked: boolean;
  canLock: boolean;
  onSetLocked: (locked: boolean) => Promise<unknown>;
};

const INPUT_CLASS =
  'h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000';

const CHIP_CLASS =
  'h-8 rounded-full border border-secondary-400 bg-white px-3 text-sm font-semibold text-secondary-800 transition-colors duration-150 hover:bg-secondary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white';

/** Skema nama level siap pakai (dari prototipe); bisa diubah sesudahnya. */
const LEVEL_PRESETS: { name: string; labels: string[] }[] = [
  { name: 'Kepanitiaan ITB', labels: ['Bidang', 'Divisi', 'Subdivisi'] },
  { name: 'Himpunan', labels: ['Departemen', 'Divisi', 'Unit Kerja'] },
  {
    name: 'Kabinet KM',
    labels: ['Kemenkoan', 'Kementerian', 'Kedirjenan', 'Biro'],
  },
];

/** Rank yang sering dibutuhkan; disisipkan di atas rank paling junior. */
const RANK_SUGGESTIONS = ['Sekretaris', 'Bendahara'];

export function SettingsView(props: SettingsViewProps): JSX.Element {
  const { draft, dispatch, canManage, editLocked, canLock, onSetLocked } =
    props;
  const baseId = useId();
  const [lockPending, setLockPending] = useState(false);

  const labels = draft.levelLabels ?? [];
  const treeDepth = Math.max(1, maxDepth(draft.units));
  const levelCount = Math.max(treeDepth, labels.length);
  const canAddLevel = levelCount < MAX_DEPTH;
  const canRemoveLevel = levelCount > treeDepth && levelCount > 1;

  const unitsAtDepth = (depth: number): number =>
    draft.units.filter((unit) => levelOf(draft.units, unit.id) === depth)
      .length;

  const writeLabels = (count: number): string[] => {
    const next: string[] = [];
    for (let index = 0; index < count; index += 1) {
      next.push(labels[index] ?? '');
    }
    return next;
  };

  const setLevelLabel = (index: number, value: string) => {
    const next = writeLabels(levelCount);
    next[index] = value;
    dispatch({ type: 'setLevelLabels', labels: next });
  };

  const addLevel = () => {
    const next = writeLabels(levelCount);
    next.push('');
    dispatch({ type: 'setLevelLabels', labels: next });
  };

  const removeLastLevel = () => {
    const next = writeLabels(levelCount - 1);
    dispatch({ type: 'setLevelLabels', labels: next });
  };

  const applyPreset = (preset: string[]) => {
    dispatch({ type: 'setLevelLabels', labels: [...preset] });
  };

  // --- Rank ---
  const ranks = effectiveRanks(draft.ranks);
  const rankUse = (id: string): number =>
    draft.positions.filter((position) => position.rank === id).length;
  const writeRanks = (next: RankDef[]) => {
    dispatch({ type: 'setRanks', ranks: next });
  };
  const editableRanks = (): RankDef[] => ranks.map((rank) => ({ ...rank }));

  const renameRank = (index: number, label: string) => {
    const next = editableRanks();
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, label };
    writeRanks(next);
  };

  const moveRank = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ranks.length) return;
    const next = editableRanks();
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    writeRanks(next);
  };

  const removeRank = (index: number) => {
    const next = editableRanks();
    next.splice(index, 1);
    writeRanks(next);
  };

  /** Rank baru masuk tepat di atas rank paling junior (biasanya di atas Staf). */
  const addRank = (label: string) => {
    const next = editableRanks();
    const id = newRankId(label, next);
    next.splice(Math.max(0, next.length - 1), 0, { id, label });
    writeRanks(next);
  };

  const canAddRank = ranks.length < MAX_RANKS;
  const hasLabel = (label: string): boolean =>
    ranks.some(
      (rank) => rank.label.trim().toLowerCase() === label.toLowerCase(),
    );
  const suggestions = RANK_SUGGESTIONS.filter((label) => !hasLabel(label));
  const defaultIds = new Set(DEFAULT_RANKS.map((rank) => rank.id));
  const canRestoreRanks =
    draft.ranks !== null &&
    draft.positions.every((position) => defaultIds.has(position.rank));

  const handleLockedChange = async (next: boolean) => {
    if (lockPending) return;
    setLockPending(true);
    try {
      await onSetLocked(next);
    } catch {
      toast.error('Gagal mengubah kunci. Coba lagi.');
    } finally {
      setLockPending(false);
    }
  };

  const lockId = `${baseId}-lock`;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl">
        {!canManage ? (
          <p className="pb-4 text-sm text-neutral-700">
            Hanya pengelola yang dapat mengubah pengaturan.
          </p>
        ) : null}

        <section className="border-b border-neutral-400 pb-5">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Nama organogram
          </h2>
          <div className="mt-3 space-y-1">
            <Label htmlFor={`${baseId}-name`}>Nama</Label>
            <Input
              id={`${baseId}-name`}
              value={draft.name}
              onChange={(event) =>
                dispatch({ type: 'setName', name: event.target.value })
              }
              placeholder="Nama organogram"
              disabled={!canManage}
              className={INPUT_CLASS}
            />
          </div>
        </section>

        <section className="border-b border-neutral-400 py-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-neutral-1000">
              Nama level
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="light_blue"
                size="sm"
                onClick={addLevel}
                disabled={!canManage || !canAddLevel}
                title={
                  canAddLevel
                    ? undefined
                    : `Kedalaman maksimum ${MAX_DEPTH} tingkat.`
                }
              >
                <Plus className="size-4" />
                Tambah level
              </Button>
              <Button
                variant="dark_blue_outline"
                size="icon"
                onClick={removeLastLevel}
                disabled={!canManage || !canRemoveLevel}
                aria-label="Hapus level terakhir"
                title="Hapus level terakhir"
              >
                <Minus className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            Nama level berlaku per kedalaman. Bagian baru memakai namanya dari
            sini, dan tiap bagian tetap bisa menimpanya di panel Detail.
          </p>

          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Skema nama level siap pakai"
          >
            <span className="text-sm text-neutral-700">Skema siap pakai:</span>
            {LEVEL_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={CHIP_CLASS}
                disabled={!canManage}
                title={preset.labels.join(' › ')}
                onClick={() => applyPreset(preset.labels)}
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              className={CHIP_CLASS}
              disabled={!canManage || draft.levelLabels === null}
              onClick={() => dispatch({ type: 'setLevelLabels', labels: null })}
            >
              Kosongkan
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {Array.from({ length: levelCount }, (_, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor={`${baseId}-level-${index}`}>
                    Level {index + 1}
                  </Label>
                  <span className="text-sm tabular-nums text-neutral-700">
                    {unitsAtDepth(index + 1)} bagian
                  </span>
                </div>
                <Input
                  id={`${baseId}-level-${index}`}
                  value={labels[index] ?? ''}
                  onChange={(event) => setLevelLabel(index, event.target.value)}
                  placeholder={levelLabelFor(index + 1, null)}
                  disabled={!canManage}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-neutral-700">
            Kolom yang dikosongkan memakai sebutan bawaan, yaitu Bagian.
          </p>
        </section>

        <section className="border-b border-neutral-400 py-5">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Rank jabatan
          </h2>
          <p className="mt-1 text-sm text-neutral-700">
            Rank menyatakan senioritas di dalam bagian, dari yang paling senior
            (atas) ke yang paling junior (bawah). Ganti namanya, ubah urutannya,
            atau tambah rank baru, misalnya Sekretaris dan Bendahara yang berada
            di bawah Kepala dan Wakil tetapi di atas Staf. Rank yang masih
            dipakai jabatan tidak bisa dihapus.
          </p>

          <ol className="mt-3 space-y-2">
            {ranks.map((rank, index) => {
              const used = rankUse(rank.id);
              const removeBlocked = used > 0 || ranks.length <= 1;
              return (
                <li key={rank.id} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="w-6 shrink-0 text-right text-sm tabular-nums text-neutral-700"
                  >
                    {index + 1}
                  </span>
                  <Input
                    value={rank.label}
                    maxLength={MAX_RANK_LABEL}
                    onChange={(event) => renameRank(index, event.target.value)}
                    disabled={!canManage}
                    aria-label={`Nama rank urutan ${index + 1}`}
                    className={`${INPUT_CLASS} min-w-0 flex-1`}
                  />
                  <span className="w-20 shrink-0 text-sm tabular-nums text-neutral-700">
                    {used} jabatan
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Naikkan ${rank.label}`}
                    title="Lebih senior"
                    disabled={!canManage || index === 0}
                    onClick={() => moveRank(index, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Turunkan ${rank.label}`}
                    title="Lebih junior"
                    disabled={!canManage || index === ranks.length - 1}
                    onClick={() => moveRank(index, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus rank ${rank.label}`}
                    title={
                      used > 0
                        ? 'Masih dipakai jabatan'
                        : ranks.length <= 1
                          ? 'Minimal satu rank'
                          : 'Hapus rank'
                    }
                    disabled={!canManage || removeBlocked}
                    onClick={() => removeRank(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="light_blue"
              size="sm"
              disabled={!canManage || !canAddRank}
              title={canAddRank ? undefined : `Maksimum ${MAX_RANKS} rank.`}
              onClick={() => addRank('Rank baru')}
            >
              <Plus className="size-4" />
              Tambah rank
            </Button>
            {suggestions.map((label) => (
              <button
                key={label}
                type="button"
                className={CHIP_CLASS}
                disabled={!canManage || !canAddRank}
                onClick={() => addRank(label)}
              >
                + {label}
              </button>
            ))}
            <button
              type="button"
              className={CHIP_CLASS}
              disabled={!canManage || !canRestoreRanks}
              title={
                draft.ranks === null
                  ? 'Sudah memakai rank bawaan'
                  : canRestoreRanks
                    ? 'Kembali ke empat rank bawaan'
                    : 'Ada jabatan yang memakai rank di luar bawaan'
              }
              onClick={() => dispatch({ type: 'setRanks', ranks: null })}
            >
              Kembalikan rank bawaan
            </button>
          </div>
        </section>

        <section className="py-5">
          <h2 className="text-lg font-semibold text-neutral-1000">
            Kunci edit
          </h2>
          <div className="mt-3 flex items-start gap-3">
            <Switch
              id={lockId}
              checked={editLocked}
              disabled={!canLock || lockPending}
              onCheckedChange={(checked) => {
                void handleLockedChange(checked);
              }}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor={lockId}>
                {editLocked ? 'Terkunci' : 'Tidak terkunci'}
              </Label>
              {lockPending ? (
                <p className="text-sm text-neutral-700">
                  Menyimpan perubahan kunci.
                </p>
              ) : null}
              <p className="text-sm text-neutral-700">
                Anggota yang ditempatkan tidak bisa mengubah organogram saat
                dikunci. Pemilik dan admin tidak terpengaruh.
              </p>
              {!canLock ? (
                <p className="text-sm text-neutral-700">
                  Hanya pemilik dan admin yang dapat mengubah kunci.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
