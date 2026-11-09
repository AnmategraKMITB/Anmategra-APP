'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { OPERATORS_BY_TYPE } from '~/lib/forms/conditions';
import { type RouterOutputs, api } from '~/trpc/react';

import {
  OPERATOR_LABELS,
  operatorIsSet,
  operatorNeedsValue,
} from '../condition-labels';
import { richTextToPlain } from '../rich-text';

type CriteriaListOutput = RouterOutputs['oprec']['criteriaList'];
type CriterionField = CriteriaListOutput['fields'][number];
type CriterionItem = CriteriaListOutput['slots'][number]['criteria'][number];

type Kind = 'skor' | 'gugur_otomatis' | 'gugur_manual';

type GateRule = {
  fieldId: string;
  op: string;
  nilai?: unknown;
  nilai2?: unknown;
};

function toKind(value: string | null | undefined): Kind {
  if (value === 'gugur_otomatis') return 'gugur_otomatis';
  if (value === 'gugur_manual') return 'gugur_manual';
  return 'skor';
}

function readGateRule(value: unknown): GateRule | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    fieldId?: unknown;
    op?: unknown;
    nilai?: unknown;
    nilai2?: unknown;
  };
  if (typeof raw.fieldId !== 'string' || typeof raw.op !== 'string')
    return null;
  return {
    fieldId: raw.fieldId,
    op: raw.op,
    nilai: raw.nilai,
    nilai2: raw.nilai2,
  };
}

function valueFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return (value as unknown[]).length > 0;
  return true;
}

function gateComplete(op: string, nilai: unknown, nilai2: unknown): boolean {
  if (op === '') return false;
  if (!operatorNeedsValue(op)) return true;
  if (operatorIsSet(op))
    return Array.isArray(nilai) && (nilai as unknown[]).length > 0;
  if (!valueFilled(nilai)) return false;
  if (op === 'antara' || op === 'pilihan_ke') return valueFilled(nilai2);
  return true;
}

function GateValueInput({
  source,
  op,
  nilai,
  nilai2,
  onChange,
}: {
  source: CriterionField;
  op: string;
  nilai: unknown;
  nilai2: unknown;
  onChange: (patch: { nilai?: unknown; nilai2?: unknown }) => void;
}) {
  if (!operatorNeedsValue(op)) return null;

  const isChoice =
    source.type === 'single_choice' ||
    source.type === 'multiple_choice' ||
    source.type === 'unit_choice';

  if (isChoice && operatorIsSet(op)) {
    const chosen = Array.isArray(nilai)
      ? (nilai as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    return (
      <div className="grid gap-1" role="group" aria-label="Pilihan">
        {source.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-2 text-sm text-neutral-1000"
          >
            <Checkbox
              checked={chosen.includes(option.id)}
              onCheckedChange={(on) =>
                onChange({
                  nilai:
                    on === true
                      ? [...chosen, option.id]
                      : chosen.filter((id) => id !== option.id),
                })
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (isChoice) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={typeof nilai === 'string' ? nilai : ''}
          onValueChange={(next) => onChange({ nilai: next })}
        >
          <SelectTrigger aria-label="Nilai" className="min-w-40">
            <SelectValue placeholder="Pilih…" />
          </SelectTrigger>
          <SelectContent>
            {source.options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {op === 'pilihan_ke' ? (
          <>
            <span className="text-sm text-neutral-700">pilihan ke-</span>
            <Input
              type="number"
              min={1}
              aria-label="Urutan pilihan"
              className="w-20"
              value={typeof nilai2 === 'number' ? String(nilai2) : ''}
              onChange={(e) =>
                onChange({
                  nilai2:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </>
        ) : null}
      </div>
    );
  }

  const numeric = source.type === 'number' || source.type === 'scale';
  const inputType = numeric
    ? 'number'
    : source.type === 'date'
      ? 'date'
      : 'text';
  const display = (value: unknown) =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const parse = (raw: string) =>
    numeric ? (raw === '' ? undefined : Number(raw)) : raw;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type={inputType}
        aria-label="Nilai"
        value={display(nilai)}
        onChange={(e) => onChange({ nilai: parse(e.target.value) })}
      />
      {op === 'antara' ? (
        <>
          <span className="text-sm text-neutral-700">dan</span>
          <Input
            type={inputType}
            aria-label="Nilai kedua"
            value={display(nilai2)}
            onChange={(e) => onChange({ nilai2: parse(e.target.value) })}
          />
        </>
      ) : null}
    </div>
  );
}

function CriterionForm({
  recruitmentId,
  scope,
  scopeLabel,
  criterion,
  fields,
  onClose,
  onSaved,
}: {
  recruitmentId: string;
  scope: string;
  scopeLabel: string;
  criterion: CriterionItem | null;
  fields: CriteriaListOutput['fields'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = api.oprec.criterionSave.useMutation();
  const [name, setName] = useState(criterion?.name ?? '');
  const [kind, setKind] = useState<Kind>(toKind(criterion?.kind));
  const [weight, setWeight] = useState(
    typeof criterion?.weight === 'number' ? String(criterion.weight) : '',
  );
  const [expectation, setExpectation] = useState(criterion?.expectation ?? '');
  const [fieldIds, setFieldIds] = useState<string[]>(criterion?.fieldIds ?? []);
  const [gate, setGate] = useState<GateRule | null>(
    readGateRule(criterion?.gateRule),
  );

  const linked = fields.filter((field) => fieldIds.includes(field.id));
  const autoSources = linked.filter(
    (field) => (OPERATORS_BY_TYPE[field.type] ?? []).length > 0,
  );
  const source: CriterionField | null =
    gate === null
      ? (autoSources[0] ?? null)
      : (autoSources.find((field) => field.id === gate.fieldId) ??
        autoSources[0] ??
        null);
  const ops: readonly string[] = source
    ? (OPERATORS_BY_TYPE[source.type] ?? [])
    : [];
  const savedOp = gate?.op;
  const op =
    savedOp !== undefined && ops.some((candidate) => candidate === savedOp)
      ? savedOp
      : (ops[0] ?? '');
  const nilai = gate?.nilai;
  const nilai2 = gate?.nilai2;

  const groups = new Map<string, CriteriaListOutput['fields']>();
  for (const field of fields) {
    const title = field.sectionTitle ?? 'Tanpa bagian';
    const list = groups.get(title) ?? [];
    list.push(field);
    groups.set(title, list);
  }

  const parsedWeight = weight.trim() === '' ? null : Number(weight);
  const weightOk =
    kind !== 'skor' ||
    parsedWeight === null ||
    (Number.isFinite(parsedWeight) && parsedWeight >= 0 && parsedWeight <= 100);
  const ruleReady = source !== null && gateComplete(op, nilai, nilai2);
  const canSave =
    name.trim().length > 0 &&
    weightOk &&
    (kind !== 'gugur_otomatis' || ruleReady);

  const describeValue = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return '';
    if (Array.isArray(value)) {
      return (value as unknown[])
        .map((item) =>
          typeof item === 'string'
            ? (source?.options.find((option) => option.id === item)?.label ??
              item)
            : String(item),
        )
        .join(', ');
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return (
        source?.options.find((option) => option.id === String(value))?.label ??
        String(value)
      );
    }
    return JSON.stringify(value);
  };

  const previewText = source
    ? `Gugur bila “${richTextToPlain(source.label)}” ${
        OPERATOR_LABELS[op] ?? op
      }${
        operatorNeedsValue(op)
          ? ` “${describeValue(nilai)}${
              op === 'antara' ? `” dan “${describeValue(nilai2)}` : ''
            }”`
          : ''
      }`
    : '';

  const setSource = (next: CriterionField) => {
    setGate({
      fieldId: next.id,
      op: (OPERATORS_BY_TYPE[next.type] ?? [])[0] ?? '',
    });
  };

  const submit = () => {
    if (!canSave) return;
    const gateRule: GateRule | null =
      kind === 'gugur_otomatis' && source
        ? {
            fieldId: source.id,
            op,
            ...(operatorNeedsValue(op)
              ? {
                  nilai,
                  ...(op === 'antara' || op === 'pilihan_ke' ? { nilai2 } : {}),
                }
              : {}),
          }
        : null;
    save.mutate(
      {
        recruitmentId,
        criterionId: criterion?.id,
        scope,
        name: name.trim(),
        kind,
        weight: kind === 'skor' ? parsedWeight : null,
        expectation: expectation.trim() === '' ? null : expectation.trim(),
        gateRule,
        fieldIds,
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {criterion ? 'Ubah kriteria' : 'Tambah kriteria'}
        </DialogTitle>
        <DialogDescription>
          Kriteria penilaian untuk slot {scopeLabel}. Nama wajib diisi, bobot
          hanya dipakai kriteria skor.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="criterion-name">Nama</Label>
          <Input
            id="criterion-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Motivasi bergabung"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="criterion-kind">Jenis</Label>
          <Select
            value={kind}
            onValueChange={(value) => setKind(toKind(value))}
          >
            <SelectTrigger id="criterion-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skor">Skor</SelectItem>
              <SelectItem value="gugur_otomatis">Gugur otomatis</SelectItem>
              <SelectItem value="gugur_manual">Gugur manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === 'skor' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="criterion-weight">Bobot</Label>
            <Input
              id="criterion-weight"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0-100"
            />
            <p className="text-sm text-neutral-700">
              Persen 0-100. Total bobot satu slot sebaiknya 100%.
            </p>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="criterion-expectation">Ekspektasi</Label>
          <textarea
            id="criterion-expectation"
            rows={3}
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            placeholder="Satu deskripsi ekspektasi umum untuk penilai"
            className="w-full rounded-lg border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-1000 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-neutral-1000">
            Pertanyaan terkait
          </legend>
          <p className="text-sm text-neutral-700">
            Pilih pertanyaan yang dinilai oleh kriteria ini.
          </p>
          {fields.length === 0 ? (
            <p className="text-sm text-neutral-700">
              Belum ada pertanyaan di formulir ini.
            </p>
          ) : (
            <div className="grid max-h-64 gap-3 overflow-y-auto rounded-xl border border-neutral-400 p-3">
              {Array.from(groups.entries()).map(([title, items]) => (
                <div key={title} className="grid gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
                    {title}
                  </p>
                  {items.map((field) => (
                    <label
                      key={field.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1 text-sm text-neutral-1000 hover:bg-neutral-200"
                    >
                      <Checkbox
                        checked={fieldIds.includes(field.id)}
                        onCheckedChange={(on) =>
                          setFieldIds((prev) =>
                            on === true
                              ? [...prev, field.id]
                              : prev.filter((id) => id !== field.id),
                          )
                        }
                      />
                      <span className="min-w-0 break-words">
                        {richTextToPlain(field.label)}
                        {field.archived ? ' (diarsipkan)' : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </fieldset>

        {kind === 'gugur_otomatis' ? (
          <div className="grid gap-2 rounded-xl border border-neutral-400 p-3">
            <p className="text-sm font-semibold text-neutral-1000">
              Aturan gugur otomatis
            </p>
            {linked.length === 0 ? (
              <p className="text-sm text-neutral-700">
                Ikat minimal satu pertanyaan dulu
              </p>
            ) : source === null ? (
              <p className="text-sm text-neutral-700">
                Pertanyaan terikat belum bisa dipakai sebagai acuan aturan.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={source.id}
                    onValueChange={(id) => {
                      const next = autoSources.find((field) => field.id === id);
                      if (next) setSource(next);
                    }}
                  >
                    <SelectTrigger aria-label="Pertanyaan acuan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {autoSources.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {richTextToPlain(field.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={op}
                    onValueChange={(nextOp) => {
                      setGate({ fieldId: source.id, op: nextOp });
                    }}
                  >
                    <SelectTrigger aria-label="Operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ops.map((candidate) => (
                        <SelectItem key={candidate} value={candidate}>
                          {OPERATOR_LABELS[candidate] ?? candidate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <GateValueInput
                  source={source}
                  op={op}
                  nilai={nilai}
                  nilai2={nilai2}
                  onChange={(patch) =>
                    setGate({ fieldId: source.id, op, ...patch })
                  }
                />
                <p className="text-sm text-neutral-700">{previewText}</p>
              </>
            )}
          </div>
        ) : null}

        {save.isError ? (
          <p role="alert" className="text-sm text-danger-dark">
            {save.error.message}
          </p>
        ) : null}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="dark_blue_outline" onClick={onClose}>
          Batal
        </Button>
        <Button
          type="button"
          variant="dark_blue"
          disabled={!canSave || save.isPending}
          onClick={submit}
        >
          {save.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CriterionDialog({
  recruitmentId,
  scope,
  scopeLabel,
  criterion,
  fields,
  open,
  onOpenChange,
  onSaved,
}: {
  recruitmentId: string;
  scope: string;
  scopeLabel: string;
  criterion?: CriterionItem | null;
  fields: CriteriaListOutput['fields'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-2xl">
        <CriterionForm
          key={`${criterion?.id ?? 'baru'}-${open ? 'buka' : 'tutup'}`}
          recruitmentId={recruitmentId}
          scope={scope}
          scopeLabel={scopeLabel}
          criterion={criterion ?? null}
          fields={fields}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
