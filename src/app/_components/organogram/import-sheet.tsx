'use client';

import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import type {
  ImportPlan,
  PlannedPosition,
  PlannedUnit,
} from '~/server/api/routers/organization/import-plan';
import { api } from '~/trpc/react';

const INPUT_CLASS =
  'h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000';
const SELECT_TRIGGER_CLASS =
  'h-9 rounded-[8px] border-neutral-400 text-sm text-neutral-1000';
const NO_MERGE = '__none__';

type Rank = PlannedPosition['rank'];

const RANK_LABELS: Record<Rank, string> = {
  head: 'Kepala',
  vice: 'Wakil',
  coordinator: 'Koordinator',
  staff: 'Staf',
};

const RANK_ORDER: Rank[] = ['head', 'vice', 'coordinator', 'staff'];

function isRank(value: string): value is Rank {
  return (
    value === 'head' ||
    value === 'vice' ||
    value === 'coordinator' ||
    value === 'staff'
  );
}

type UnitState = { name: string; mergeInto: string | null; skip: boolean };
type PositionState = {
  title: string;
  rank: Rank;
  mergeInto: string | null;
  skip: boolean;
};

type UnitDecisionInput = {
  key: string;
  name: string;
  mergeInto?: string;
  skip?: boolean;
};

type PositionDecisionInput = {
  key: string;
  title: string;
  rank: Rank;
  kind: PlannedPosition['kind'];
  mergeInto?: string;
  skip?: boolean;
};

export type ImportSheetProps = {
  periodId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
};

export function ImportSheet(props: ImportSheetProps): JSX.Element {
  const { periodId, open, onOpenChange, onImported } = props;
  const preview = api.organization.import.preview.useQuery(
    { periodId },
    { enabled: open, staleTime: 0, refetchOnWindowFocus: false },
  );

  const renderBody = (): JSX.Element => {
    if (preview.error) {
      return (
        <div className="flex flex-1 flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm text-danger-dark">
            {preview.error.message}
          </p>
          <Button
            variant="dark_blue_outline"
            size="sm"
            onClick={() => {
              void preview.refetch();
            }}
          >
            Coba lagi
          </Button>
        </div>
      );
    }

    const data = preview.data;
    if (!data) {
      return (
        <p className="flex-1 p-4 text-sm text-neutral-700">Membaca data lama</p>
      );
    }

    if (data.blocked === 'sudah_berisi') {
      return (
        <p className="flex-1 p-4 text-sm text-neutral-700">
          Organogram periode ini sudah berisi, jadi tidak bisa diimpor.
        </p>
      );
    }

    if (data.blocked === 'tidak_ada_data') {
      return (
        <p className="flex-1 p-4 text-sm text-neutral-700">
          Tidak ada data lama untuk diimpor pada periode ini.
        </p>
      );
    }

    return (
      <ReviewForm
        key={data.fingerprint}
        plan={data.plan}
        sources={data.sources}
        fingerprint={data.fingerprint}
        periodId={periodId}
        onImported={onImported}
        onOpenChange={onOpenChange}
        onReload={() => {
          void preview.refetch();
        }}
      />
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-neutral-400 p-4 pr-12">
          <SheetTitle className="text-neutral-1000">
            Impor dari data lama
          </SheetTitle>
          <SheetDescription className="text-sm text-neutral-700">
            Tinjau usulan bagian dan jabatan dari teks lama. Gabungkan ejaan
            yang sama, perbaiki nama, atau lewati yang tidak perlu. Tidak ada
            yang tersimpan sebelum Anda menekan Impor.
          </SheetDescription>
        </SheetHeader>
        {renderBody()}
      </SheetContent>
    </Sheet>
  );
}

type ReviewFormProps = {
  plan: ImportPlan;
  sources: { keanggotaan: number; kehimpunan: number };
  fingerprint: string;
  periodId: string;
  onImported: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
};

function initialUnitState(plan: ImportPlan): Record<string, UnitState> {
  const state: Record<string, UnitState> = {};
  for (const unit of plan.units) {
    state[unit.key] = { name: unit.name, mergeInto: null, skip: false };
  }
  return state;
}

function initialPositionState(plan: ImportPlan): Record<string, PositionState> {
  const state: Record<string, PositionState> = {};
  for (const position of plan.positions) {
    state[position.key] = {
      title: position.title,
      rank: position.rank,
      mergeInto: null,
      skip: false,
    };
  }
  return state;
}

function ReviewForm(props: ReviewFormProps): JSX.Element {
  const {
    plan,
    sources,
    fingerprint,
    periodId,
    onImported,
    onOpenChange,
    onReload,
  } = props;
  const baseId = useId();
  const searchId = `${baseId}-search`;
  const [unitState, setUnitState] = useState<Record<string, UnitState>>(() =>
    initialUnitState(plan),
  );
  const [positionState, setPositionState] = useState<
    Record<string, PositionState>
  >(() => initialPositionState(plan));
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const commit = api.organization.import.commit.useMutation();

  const positionUnitKey = new Map<string, string>();
  const positionsByUnit = new Map<string, PlannedPosition[]>();
  for (const position of plan.positions) {
    positionUnitKey.set(position.key, position.unitKey);
    const list = positionsByUnit.get(position.unitKey) ?? [];
    list.push(position);
    positionsByUnit.set(position.unitKey, list);
  }

  const unitUsers = new Map<string, Set<string>>();
  const positionUsers = new Map<string, Set<string>>();
  const everyone = new Set<string>();
  for (const placement of plan.placements) {
    everyone.add(placement.userId);
    const unitKey = positionUnitKey.get(placement.positionKey);
    if (unitKey !== undefined) {
      const set = unitUsers.get(unitKey) ?? new Set<string>();
      set.add(placement.userId);
      unitUsers.set(unitKey, set);
    }
    const positionSet =
      positionUsers.get(placement.positionKey) ?? new Set<string>();
    positionSet.add(placement.userId);
    positionUsers.set(placement.positionKey, positionSet);
  }

  const term = search.trim().toLowerCase();
  const visibleUnits = plan.units.filter((unit) => {
    if (term === '') return true;
    const name = (unitState[unit.key]?.name ?? unit.name).toLowerCase();
    if (name.includes(term)) return true;
    const list = positionsByUnit.get(unit.key) ?? [];
    return list.some((position) =>
      (positionState[position.key]?.title ?? position.title)
        .toLowerCase()
        .includes(term),
    );
  });

  // Nama yang masih dipakai (tidak dilewati dan tidak digabung) tidak boleh kosong.
  let hasBlankName = false;
  for (const unit of plan.units) {
    const value = unitState[unit.key];
    if (value?.skip === true) continue;
    if (
      (value?.mergeInto ?? null) === null &&
      (value?.name ?? unit.name).trim() === ''
    ) {
      hasBlankName = true;
      break;
    }
    for (const position of positionsByUnit.get(unit.key) ?? []) {
      const positionValue = positionState[position.key];
      if (positionValue?.skip === true) continue;
      if ((positionValue?.mergeInto ?? null) !== null) continue;
      if ((positionValue?.title ?? position.title).trim() === '') {
        hasBlankName = true;
      }
    }
    if (hasBlankName) break;
  }

  const sourceParts: string[] = [];
  if (sources.keanggotaan > 0) {
    sourceParts.push(`${sources.keanggotaan} baris keanggotaan kegiatan`);
  }
  if (sources.kehimpunan > 0) {
    sourceParts.push(`${sources.kehimpunan} baris keanggotaan lembaga`);
  }

  const handleUnitChange = (key: string, patch: Partial<UnitState>) => {
    setUnitState((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: {
          name: patch.name ?? current?.name ?? '',
          mergeInto:
            patch.mergeInto === undefined
              ? (current?.mergeInto ?? null)
              : patch.mergeInto,
          skip: patch.skip ?? current?.skip ?? false,
        },
      };
    });
  };

  const handlePositionChange = (key: string, patch: Partial<PositionState>) => {
    setPositionState((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: {
          title: patch.title ?? current?.title ?? '',
          rank: patch.rank ?? current?.rank ?? 'staff',
          mergeInto:
            patch.mergeInto === undefined
              ? (current?.mergeInto ?? null)
              : patch.mergeInto,
          skip: patch.skip ?? current?.skip ?? false,
        },
      };
    });
  };

  const handleImport = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const units: UnitDecisionInput[] = plan.units.map((unit) => {
        const value = unitState[unit.key];
        const decision: UnitDecisionInput = {
          key: unit.key,
          name: (value?.name ?? unit.name).trim(),
        };
        const mergeInto = value?.mergeInto ?? null;
        if (mergeInto !== null) decision.mergeInto = mergeInto;
        if (value?.skip === true) decision.skip = true;
        return decision;
      });

      const positions: PositionDecisionInput[] = plan.positions.map(
        (position) => {
          const value = positionState[position.key];
          const decision: PositionDecisionInput = {
            key: position.key,
            title: (value?.title ?? position.title).trim(),
            rank: value?.rank ?? position.rank,
            kind: position.kind,
          };
          const mergeInto = value?.mergeInto ?? null;
          if (mergeInto !== null) decision.mergeInto = mergeInto;
          if (value?.skip === true) decision.skip = true;
          return decision;
        },
      );

      const result = await commit.mutateAsync({
        periodId,
        fingerprint,
        units,
        positions,
      });
      toast.success(
        `Impor selesai: ${result.units} bagian, ${result.positions} jabatan, ${result.placements} orang.`,
      );
      await onImported();
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Impor gagal. Coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-neutral-400 p-4">
        <p className="text-sm tabular-nums text-neutral-700">
          {everyone.size} orang, {plan.units.length} bagian,{' '}
          {plan.positions.length} jabatan.
        </p>
        {plan.membershipOnly > 0 ? (
          <p className="text-sm text-neutral-700">
            {plan.membershipOnly} orang tidak punya bagian dan jabatan; mereka
            tetap anggota lembaga dan tidak ditempatkan.
          </p>
        ) : null}
        {sourceParts.length > 0 ? (
          <p className="text-sm text-neutral-700">
            Sumber: {sourceParts.join(', ')}.
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor={searchId}>Cari</Label>
          <Input
            id={searchId}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nama bagian atau jabatan"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleUnits.length === 0 ? (
          <p className="p-4 text-sm text-neutral-700">
            Tidak ada bagian atau jabatan yang cocok.
          </p>
        ) : null}
        {visibleUnits.map((unit) => (
          <UnitSection
            key={unit.key}
            unit={unit}
            state={
              unitState[unit.key] ?? {
                name: unit.name,
                mergeInto: null,
                skip: false,
              }
            }
            units={plan.units}
            unitState={unitState}
            positions={positionsByUnit.get(unit.key) ?? []}
            positionState={positionState}
            people={unitUsers.get(unit.key)?.size ?? 0}
            peopleOf={(key) => positionUsers.get(key)?.size ?? 0}
            onUnitChange={handleUnitChange}
            onPositionChange={handlePositionChange}
          />
        ))}
      </div>

      {error !== null ? (
        <div className="border-t border-neutral-400 px-4 py-3">
          <p role="alert" className="text-sm text-danger-dark">
            {error}
          </p>
          {error.includes('Data lama berubah') ? (
            <Button
              variant="dark_blue_outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setError(null);
                onReload();
              }}
            >
              Muat ulang usulan
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-neutral-400 p-4">
        {hasBlankName ? (
          <p className="mb-2 text-sm text-neutral-700">
            Isi nama bagian dan jabatan yang kosong.
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="dark_blue_outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            variant="light_blue"
            onClick={() => {
              void handleImport();
            }}
            disabled={hasBlankName || submitting}
          >
            {submitting ? 'Mengimpor' : 'Impor'}
          </Button>
        </div>
      </div>
    </div>
  );
}

type UnitSectionProps = {
  unit: PlannedUnit;
  state: UnitState;
  units: PlannedUnit[];
  unitState: Record<string, UnitState>;
  positions: PlannedPosition[];
  positionState: Record<string, PositionState>;
  people: number;
  peopleOf: (positionKey: string) => number;
  onUnitChange: (key: string, patch: Partial<UnitState>) => void;
  onPositionChange: (key: string, patch: Partial<PositionState>) => void;
};

function UnitSection(props: UnitSectionProps): JSX.Element {
  const {
    unit,
    state,
    units,
    unitState,
    positions,
    positionState,
    people,
    peopleOf,
    onUnitChange,
    onPositionChange,
  } = props;
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const mergeId = `${baseId}-merge`;
  const skipId = `${baseId}-skip`;
  const unitSkipped = state.skip;

  const mergeTargets = units.filter(
    (other) =>
      other.key !== unit.key &&
      (unitState[other.key]?.mergeInto ?? null) === null,
  );

  return (
    <section
      aria-label={`Bagian ${state.name.trim() === '' ? unit.name : state.name}`}
      className={
        unitSkipped
          ? 'border-b border-neutral-400 p-4 opacity-60'
          : 'border-b border-neutral-400 p-4'
      }
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={nameId}>Nama bagian</Label>
          <Input
            id={nameId}
            value={state.name}
            onChange={(event) =>
              onUnitChange(unit.key, { name: event.target.value })
            }
            disabled={unitSkipped}
            className={INPUT_CLASS}
          />
        </div>
        <p className="pb-2 text-sm tabular-nums text-neutral-700">
          {people} orang
        </p>
      </div>

      {unit.variants.length > 1 ? (
        <p className="mt-2 text-sm text-neutral-700">
          Ejaan di data lama: {unit.variants.join(', ')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-52 space-y-1">
          <Label htmlFor={mergeId}>Gabung ke</Label>
          <Select
            value={state.mergeInto ?? NO_MERGE}
            onValueChange={(value) =>
              onUnitChange(unit.key, {
                mergeInto: value === NO_MERGE ? null : value,
              })
            }
            disabled={unitSkipped}
          >
            <SelectTrigger id={mergeId} className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Tidak digabung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MERGE}>Tidak digabung</SelectItem>
              {mergeTargets.map((other) => (
                <SelectItem key={other.key} value={other.key}>
                  {unitState[other.key]?.name ?? other.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id={skipId}
            checked={unitSkipped}
            onCheckedChange={(checked) =>
              onUnitChange(unit.key, { skip: checked === true })
            }
          />
          <Label htmlFor={skipId}>Lewati</Label>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {positions.map((position) => (
          <PositionRow
            key={position.key}
            position={position}
            state={
              positionState[position.key] ?? {
                title: position.title,
                rank: position.rank,
                mergeInto: null,
                skip: false,
              }
            }
            siblings={positions}
            positionState={positionState}
            people={peopleOf(position.key)}
            unitSkipped={unitSkipped}
            onChange={onPositionChange}
          />
        ))}
      </div>
    </section>
  );
}

type PositionRowProps = {
  position: PlannedPosition;
  state: PositionState;
  siblings: PlannedPosition[];
  positionState: Record<string, PositionState>;
  people: number;
  unitSkipped: boolean;
  onChange: (key: string, patch: Partial<PositionState>) => void;
};

function PositionRow(props: PositionRowProps): JSX.Element {
  const {
    position,
    state,
    siblings,
    positionState,
    people,
    unitSkipped,
    onChange,
  } = props;
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const rankId = `${baseId}-rank`;
  const mergeId = `${baseId}-merge`;
  const skipId = `${baseId}-skip`;

  const mergeTargets = siblings.filter(
    (other) =>
      other.key !== position.key &&
      (positionState[other.key]?.mergeInto ?? null) === null,
  );

  return (
    <div className="rounded-[8px] border border-neutral-400 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor={titleId}>Nama jabatan</Label>
          <Input
            id={titleId}
            value={state.title}
            onChange={(event) =>
              onChange(position.key, { title: event.target.value })
            }
            disabled={unitSkipped}
            className={INPUT_CLASS}
          />
        </div>
        <div className="w-36 space-y-1">
          <Label htmlFor={rankId}>Rank</Label>
          <Select
            value={state.rank}
            onValueChange={(value) => {
              if (isRank(value)) onChange(position.key, { rank: value });
            }}
            disabled={unitSkipped}
          >
            <SelectTrigger id={rankId} className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Rank" />
            </SelectTrigger>
            <SelectContent>
              {RANK_ORDER.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {RANK_LABELS[rank]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="pb-2 text-sm tabular-nums text-neutral-700">
          {people} orang
        </p>
      </div>

      {position.variants.length > 1 ? (
        <p className="mt-2 text-sm text-neutral-700">
          Ejaan di data lama: {position.variants.join(', ')}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div className="min-w-52 space-y-1">
          <Label htmlFor={mergeId}>Gabung ke</Label>
          <Select
            value={state.mergeInto ?? NO_MERGE}
            onValueChange={(value) =>
              onChange(position.key, {
                mergeInto: value === NO_MERGE ? null : value,
              })
            }
            disabled={unitSkipped || mergeTargets.length === 0}
          >
            <SelectTrigger id={mergeId} className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Tidak digabung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MERGE}>Tidak digabung</SelectItem>
              {mergeTargets.map((other) => (
                <SelectItem key={other.key} value={other.key}>
                  {positionState[other.key]?.title ?? other.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id={skipId}
            checked={state.skip}
            disabled={unitSkipped}
            onCheckedChange={(checked) =>
              onChange(position.key, { skip: checked === true })
            }
          />
          <Label htmlFor={skipId}>Lewati</Label>
        </div>
      </div>
    </div>
  );
}

/**
 * Tombol masuk ke lembar tinjauan di keadaan kosong editor. Hanya tampil bila
 * periode punya data lama yang bisa diimpor.
 */
export function ImportEntry(props: {
  periodId: string;
  onImported: () => void | Promise<void>;
}): JSX.Element | null {
  const { periodId, onImported } = props;
  const [open, setOpen] = useState(false);
  const preview = api.organization.import.preview.useQuery(
    { periodId },
    { staleTime: 0, refetchOnWindowFocus: false },
  );
  const data = preview.data;
  if (data?.blocked !== null) return null;

  const people = new Set(data.plan.placements.map((p) => p.userId)).size;
  return (
    <div className="mt-2 flex max-w-md flex-col items-center gap-2 border-t border-neutral-400 pt-4">
      <p className="text-sm text-neutral-700">
        Ada {people} orang dengan teks bagian dan jabatan dari data lama. Tinjau
        dulu, lalu impor sebagai kerangka awal.
      </p>
      <Button variant="dark_blue_outline" onClick={() => setOpen(true)}>
        Impor dari data lama
      </Button>
      <ImportSheet
        periodId={periodId}
        open={open}
        onOpenChange={setOpen}
        onImported={onImported}
      />
    </div>
  );
}

/**
 * Tombol Impor untuk header editor. Selalu dapat dibuka; lembar impor sendiri
 * yang menjelaskan bila periode ini belum punya data lama atau organogramnya
 * sudah berisi.
 */
export function ImportButton(props: {
  periodId: string;
  onImported: () => void | Promise<void>;
}): JSX.Element {
  const { periodId, onImported } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="dark_blue_outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Upload className="size-4" />
        Impor
      </Button>
      <ImportSheet
        periodId={periodId}
        open={open}
        onOpenChange={setOpen}
        onImported={onImported}
      />
    </>
  );
}
