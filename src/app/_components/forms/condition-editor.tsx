'use client';

import { GitBranch, Plus, Trash2 } from 'lucide-react';
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
import {
  MAX_RULES,
  OPERATORS_BY_TYPE,
  readCondition,
} from '~/lib/forms/conditions';
import type { ConditionInput } from '~/server/api/types/form.type';

import {
  OPERATOR_LABELS,
  describeCondition,
  operatorIsSet,
  operatorNeedsValue,
} from './condition-labels';
import { richTextToPlain } from './rich-text';

export type ConditionSource = {
  id: string;
  type: string;
  label: string;
  options: { id: string; label: string }[];
};

type Rule = ConditionInput['aturan'][number];

const emptyRuleFor = (source: ConditionSource): Rule => ({
  jenis: 'jawaban',
  fieldId: source.id,
  op: OPERATORS_BY_TYPE[source.type]![0]!,
});

/** Aturan yang belum lengkap tidak boleh disimpan. */
function ruleComplete(rule: Rule): boolean {
  if (!operatorNeedsValue(rule.op)) return true;
  if (operatorIsSet(rule.op)) {
    return Array.isArray(rule.nilai) && rule.nilai.length > 0;
  }
  const filled = (v: unknown) =>
    v !== undefined && v !== null && v !== '' && !Array.isArray(v);
  if (!filled(rule.nilai)) return false;
  return (
    (rule.op !== 'antara' && rule.op !== 'pilihan_ke') || filled(rule.nilai2)
  );
}

function ValueInput({
  rule,
  source,
  onChange,
}: {
  rule: Rule;
  source: ConditionSource;
  onChange: (patch: Partial<Rule>) => void;
}) {
  if (!operatorNeedsValue(rule.op)) return null;
  const isChoice =
    source.type === 'single_choice' ||
    source.type === 'multiple_choice' ||
    source.type === 'unit_choice';

  if (isChoice && operatorIsSet(rule.op)) {
    const chosen = Array.isArray(rule.nilai) ? rule.nilai : [];
    return (
      <div className="grid gap-1.5" role="group" aria-label="Pilihan">
        {source.options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={chosen.includes(o.id)}
              onCheckedChange={(on) =>
                onChange({
                  nilai: on
                    ? [...chosen, o.id]
                    : chosen.filter((id) => id !== o.id),
                })
              }
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (isChoice) {
    return (
      <div className="flex items-center gap-2">
        <Select
          value={typeof rule.nilai === 'string' ? rule.nilai : ''}
          onValueChange={(nilai) => onChange({ nilai })}
        >
          <SelectTrigger aria-label="Pilihan">
            <SelectValue placeholder="Pilih…" />
          </SelectTrigger>
          <SelectContent>
            {source.options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rule.op === 'pilihan_ke' ? (
          <>
            <span className="shrink-0 text-sm text-neutral-700">
              pilihan ke-
            </span>
            <Input
              type="number"
              min={1}
              aria-label="Urutan pilihan"
              className="w-20"
              value={typeof rule.nilai2 === 'number' ? String(rule.nilai2) : ''}
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
  const kind = numeric ? 'number' : source.type === 'date' ? 'date' : 'text';
  const parse = (raw: string) =>
    numeric ? (raw === '' ? '' : Number(raw)) : raw;
  const value = (v: unknown) =>
    typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  return (
    <div className="flex items-center gap-2">
      <Input
        type={kind}
        aria-label="Nilai"
        value={value(rule.nilai)}
        onChange={(e) => onChange({ nilai: parse(e.target.value) })}
      />
      {rule.op === 'antara' ? (
        <>
          <span className="text-sm text-neutral-700">dan</span>
          <Input
            type={kind}
            aria-label="Nilai kedua"
            value={value(rule.nilai2)}
            onChange={(e) => onChange({ nilai2: parse(e.target.value) })}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * Chip "Tampil jika …" dan dialog pembuat kondisinya. `sources` hanya berisi
 * pertanyaan yang lebih dulu dari target dan berjenis sah sebagai sumber.
 */
export function ConditionEditor({
  value,
  sources,
  title,
  onSave,
}: {
  value: unknown;
  sources: ConditionSource[];
  title: string;
  onSave: (next: ConditionInput | null) => void;
}) {
  const current = readCondition(value) as ConditionInput | null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ConditionInput>({
    cocok: 'semua',
    aturan: [],
  });
  const summary = describeCondition(current, sources);
  const canAdd = sources.length > 0;

  const start = () => {
    setDraft(
      current && current.aturan.length > 0
        ? structuredClone(current)
        : { cocok: 'semua', aturan: canAdd ? [emptyRuleFor(sources[0]!)] : [] },
    );
    setOpen(true);
  };

  const setRule = (i: number, patch: Partial<Rule>) =>
    setDraft((d) => ({
      ...d,
      aturan: d.aturan.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));

  const valid = draft.aturan.length > 0 && draft.aturan.every(ruleComplete);

  return (
    <>
      <button
        type="button"
        onClick={start}
        title={summary ? `Tampil jika ${summary}` : undefined}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-400 bg-neutral-50 px-3 py-1 text-sm text-neutral-700 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <GitBranch className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          {summary ? `Tampil jika ${summary}` : 'Tampil jika…'}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tampil jika</DialogTitle>
            <DialogDescription>
              {richTextToPlain(title)} hanya tampil bila aturan di bawah
              terpenuhi. Tanpa aturan, selalu tampil.
            </DialogDescription>
          </DialogHeader>

          {!canAdd ? (
            <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-700">
              Belum ada pertanyaan sebelumnya yang bisa dijadikan acuan.
              Pilihan, teks, angka, skala, tanggal, dan kotak centang bisa
              dipakai sebagai acuan.
            </p>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="cond-cocok">Tampil bila</Label>
                <Select
                  value={draft.cocok}
                  onValueChange={(cocok) =>
                    setDraft((d) => ({
                      ...d,
                      cocok: cocok as ConditionInput['cocok'],
                    }))
                  }
                >
                  <SelectTrigger id="cond-cocok" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">semua aturan cocok</SelectItem>
                    <SelectItem value="salah-satu">
                      salah satu aturan cocok
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {draft.aturan.map((rule, i) => {
                const source =
                  sources.find((s) => s.id === rule.fieldId) ?? sources[0]!;
                return (
                  <fieldset
                    key={i}
                    className="grid gap-2 rounded-xl border border-neutral-400 p-3"
                  >
                    <legend className="px-1 text-sm text-neutral-700">
                      Aturan {i + 1}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select
                        value={source.id}
                        onValueChange={(id) => {
                          const next = sources.find((s) => s.id === id)!;
                          setRule(i, {
                            ...emptyRuleFor(next),
                            nilai: undefined,
                            nilai2: undefined,
                          });
                        }}
                      >
                        <SelectTrigger aria-label="Pertanyaan acuan">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sources.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {richTextToPlain(s.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={rule.op}
                        onValueChange={(op) =>
                          setRule(i, {
                            op,
                            nilai: undefined,
                            nilai2: undefined,
                          })
                        }
                      >
                        <SelectTrigger aria-label="Operator">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(OPERATORS_BY_TYPE[source.type] ?? []).map((op) => (
                            <SelectItem key={op} value={op}>
                              {OPERATOR_LABELS[op] ?? op}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <ValueInput
                      rule={rule}
                      source={source}
                      onChange={(patch) => setRule(i, patch)}
                    />
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-dark hover:text-danger-dark"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            aturan: d.aturan.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <Trash2 /> Hapus aturan
                      </Button>
                    </div>
                  </fieldset>
                );
              })}

              <div>
                <Button
                  type="button"
                  variant="dark_blue_outline"
                  size="sm"
                  disabled={draft.aturan.length >= MAX_RULES}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      aturan: [...d.aturan, emptyRuleFor(sources[0]!)],
                    }))
                  }
                >
                  <Plus /> Tambah aturan
                </Button>
                {draft.aturan.length >= MAX_RULES ? (
                  <span className="ml-2 text-sm text-neutral-700">
                    Maksimal {MAX_RULES} aturan.
                  </span>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {current ? (
              <Button
                variant="warning_outline"
                className="sm:mr-auto"
                onClick={() => {
                  onSave(null);
                  setOpen(false);
                }}
              >
                Hapus kondisi
              </Button>
            ) : null}
            <Button variant="dark_blue_outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              variant="dark_blue"
              disabled={!canAdd || !valid}
              onClick={() => {
                onSave(draft);
                setOpen(false);
              }}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
