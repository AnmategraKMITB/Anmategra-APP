'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';

import {
  DEFAULT_RANK_LABELS,
  type Draft,
  type EditorAction,
  MAX_DEPTH,
  RANKS,
  type Rank,
  levelLabelFor,
  maxDepth,
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

  const setRankLabel = (rank: Rank, value: string) => {
    dispatch({
      type: 'setRankLabels',
      labels: { ...(draft.rankLabels ?? {}), [rank]: value },
    });
  };

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
          <div className="mt-3 space-y-3">
            {Array.from({ length: levelCount }, (_, index) => (
              <div key={index} className="space-y-1">
                <Label htmlFor={`${baseId}-level-${index}`}>
                  Level {index + 1}
                </Label>
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
          <p className="mt-2 text-xs text-neutral-700">
            Kolom yang dikosongkan memakai sebutan bawaan, yaitu Bagian.
          </p>
        </section>

        <section className="border-b border-neutral-400 py-5">
          <h2 className="text-lg font-semibold text-neutral-1000">Nama rank</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {RANKS.map((rank) => (
              <div key={rank} className="space-y-1">
                <Label htmlFor={`${baseId}-rank-${rank}`}>
                  {DEFAULT_RANK_LABELS[rank]}
                </Label>
                <Input
                  id={`${baseId}-rank-${rank}`}
                  value={draft.rankLabels?.[rank] ?? ''}
                  onChange={(event) => setRankLabel(rank, event.target.value)}
                  placeholder={DEFAULT_RANK_LABELS[rank]}
                  disabled={!canManage}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
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
                <p className="text-xs text-neutral-700">
                  Menyimpan perubahan kunci.
                </p>
              ) : null}
              <p className="text-xs text-neutral-700">
                Anggota yang ditempatkan tidak bisa mengubah organogram saat
                dikunci. Pemilik dan admin tidak terpengaruh.
              </p>
              {!canLock ? (
                <p className="text-xs text-neutral-700">
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
