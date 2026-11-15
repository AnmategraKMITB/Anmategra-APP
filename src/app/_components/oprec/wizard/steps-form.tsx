'use client';

import { findAttachment } from './helpers';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import {
  ChoicesArt,
  LinksArt,
  MoveArt,
  RulesArt,
  SectionsArt,
} from './illustrations';
import {
  ATTACHMENT_PRESETS,
  ATTRIBUTE_CHOICES,
  ATTRIBUTE_OPS,
  OP_LABELS,
  type RuleDraft,
} from './model';
import { type StepProps } from './steps-types';
import { Labeled, Note, OptionCards, StepFrame, fieldClass } from './ui';

export function StepSyarat({ s, update, c }: StepProps) {
  const e = s.eligibility;
  const setRule = (i: number, patch: Partial<RuleDraft>) =>
    update({
      eligibility: {
        ...e,
        rules: e.rules.map((r, j) => {
          if (j !== i) return r;
          const next = { ...r, ...patch };
          // Operator harus sah untuk atributnya.
          if (
            patch.attribute &&
            !ATTRIBUTE_OPS[next.attribute].ops.includes(next.op)
          ) {
            next.op = ATTRIBUTE_OPS[next.attribute].ops[0]!;
            next.value = '';
          }
          return next;
        }),
      },
    });
  const addRule = () =>
    update({
      eligibility: {
        ...e,
        rules: [
          ...e.rules,
          { attribute: 'angkatan_kuliah', op: 'eq', value: '' },
        ],
      },
    });

  return (
    <StepFrame
      title="Siapa saja yang boleh mendaftar?"
      hint="Syarat dicek saat formulir dibuka: yang belum memenuhi melihat penjelasan, bukan formulirnya."
      illustration={<RulesArt />}
    >
      <OptionCards
        label="Syarat pendaftar"
        value={e.enabled ? 'atur' : 'semua'}
        onChange={(v) =>
          update({
            eligibility: {
              ...e,
              enabled: v === 'atur',
              rules:
                v === 'atur' && e.rules.length === 0
                  ? [{ attribute: 'angkatan_kuliah', op: 'eq', value: '' }]
                  : e.rules,
            },
          })
        }
        options={[
          {
            value: 'semua',
            label: 'Semua mahasiswa aktif',
            description: 'Tanpa syarat tambahan.',
          },
          {
            value: 'atur',
            label: 'Atur syarat',
            description: 'Angkatan, program studi, keanggotaan, dan lainnya.',
          },
        ]}
      />
      {e.enabled ? (
        <div className="mt-6 grid gap-3">
          {e.rules.length > 1 ? (
            <Labeled label="Pendaftar harus memenuhi">
              {(id) => (
                <select
                  id={id}
                  className={cn(fieldClass, 'max-w-xs')}
                  value={e.match}
                  onChange={(ev) =>
                    update({
                      eligibility: {
                        ...e,
                        match: ev.target.value as 'all' | 'any',
                      },
                    })
                  }
                >
                  <option value="all">Semua syarat</option>
                  <option value="any">Salah satu syarat</option>
                </select>
              )}
            </Labeled>
          ) : null}
          {e.rules.map((r, i) => {
            const meta = ATTRIBUTE_OPS[r.attribute];
            return (
              <div
                key={i}
                className="grid gap-3 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end [&>*]:min-w-0"
              >
                <Labeled label="Atribut">
                  {(id) => (
                    <select
                      id={id}
                      className={fieldClass}
                      value={r.attribute}
                      onChange={(ev) =>
                        setRule(i, {
                          attribute: ev.target.value as RuleDraft['attribute'],
                        })
                      }
                    >
                      {ATTRIBUTE_CHOICES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label[0]!.toUpperCase() + a.label.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </Labeled>
                <Labeled label="Syarat">
                  {(id) => (
                    <select
                      id={id}
                      className={fieldClass}
                      value={r.op}
                      onChange={(ev) =>
                        setRule(i, { op: ev.target.value as RuleDraft['op'] })
                      }
                    >
                      {meta.ops.map((op) => (
                        <option key={op} value={op}>
                          {OP_LABELS[op]}
                        </option>
                      ))}
                    </select>
                  )}
                </Labeled>
                <Labeled
                  label="Nilai"
                  hint={
                    r.op === 'between' || r.op === 'in' || r.op === 'not_in'
                      ? 'Pisahkan dengan koma.'
                      : undefined
                  }
                >
                  {(id) =>
                    meta.kind === 'status' ? (
                      <select
                        id={id}
                        className={fieldClass}
                        value={r.value}
                        onChange={(ev) =>
                          setRule(i, { value: ev.target.value })
                        }
                      >
                        <option value="">Pilih…</option>
                        <option value="aktif">Aktif</option>
                        <option value="alumni">Alumni</option>
                      </select>
                    ) : meta.kind === 'lembaga' ? (
                      <input
                        id={id}
                        className={fieldClass}
                        value={c.lembagaId ? 'Lembaga ini' : 'Tidak tersedia'}
                        disabled
                        readOnly
                      />
                    ) : (
                      <input
                        id={id}
                        className={fieldClass}
                        inputMode={meta.kind === 'number' ? 'numeric' : 'text'}
                        placeholder={
                          meta.kind === 'number'
                            ? 'mis. 2024'
                            : 'mis. Teknik Informatika'
                        }
                        value={r.value}
                        onChange={(ev) =>
                          setRule(i, { value: ev.target.value })
                        }
                      />
                    )
                  }
                </Labeled>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus syarat ${i + 1}`}
                  onClick={() =>
                    update({
                      eligibility: {
                        ...e,
                        rules: e.rules.filter((_, j) => j !== i),
                      },
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="dark_blue_outline"
              size="sm"
              onClick={addRule}
            >
              <Plus /> Tambah syarat
            </Button>
          </div>
          {e.rules.some((r) => r.attribute === 'fakultas') ? (
            <Note tone="warn">
              Data fakultas belum tersimpan di akun mahasiswa, jadi syarat
              fakultas belum bisa dicek: semua pendaftar akan dianggap belum
              memenuhi. Pakai program studi untuk sementara.
            </Note>
          ) : null}
          {e.rules.some((r) => r.attribute === 'keanggotaan_lembaga') ? (
            <Note>
              Syarat keanggotaan memakai lembaga yang menjalankan oprec ini.
            </Note>
          ) : null}
        </div>
      ) : null}
    </StepFrame>
  );
}

const CHOICE_PRESETS: { label: string; min: number; max: number }[] = [
  { label: '1', min: 1, max: 1 },
  { label: '1–2', min: 1, max: 2 },
  { label: '1–3', min: 1, max: 3 },
  { label: '2–3', min: 2, max: 3 },
  { label: '1–5', min: 1, max: 5 },
];

export function StepPilihan({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  const presetKey = `${s.minChoices}-${s.maxChoices}`;
  const isPreset = CHOICE_PRESETS.some(
    (p) => `${p.min}-${p.max}` === presetKey,
  );
  const [custom, setCustom] = useState(!isPreset);
  return (
    <StepFrame
      title={`Pendaftar boleh memilih berapa ${l2}?`}
      hint="Menentukan jumlah pilihan di formulir: pilihan 1, 2, 3, dan seterusnya."
      illustration={<ChoicesArt />}
    >
      <div
        role="radiogroup"
        aria-label="Jumlah pilihan"
        className="flex flex-wrap gap-2"
      >
        {CHOICE_PRESETS.map((p) => {
          const selected =
            !custom && p.min === s.minChoices && p.max === s.maxChoices;
          const tooMany = p.max > c.divisionCount;
          return (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={tooMany}
              title={
                tooMany
                  ? `Hanya ${c.divisionCount} ${l2} yang dibuka`
                  : undefined
              }
              onClick={() => {
                setCustom(false);
                update({ minChoices: p.min, maxChoices: p.max });
              }}
              className={cn(
                'h-10 min-w-16 rounded-full border px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'border-primary-400 bg-primary-400 text-neutral-50'
                  : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300',
              )}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => setCustom(true)}
          className={cn(
            'h-10 rounded-full border px-5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
            custom
              ? 'border-primary-400 bg-primary-400 text-neutral-50'
              : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300',
          )}
        >
          Atur sendiri
        </button>
      </div>
      {custom ? (
        <div className="mt-5 grid max-w-sm grid-cols-2 gap-3">
          <Labeled label="Minimum">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={10}
                className={fieldClass}
                value={s.minChoices}
                onChange={(e) => update({ minChoices: Number(e.target.value) })}
              />
            )}
          </Labeled>
          <Labeled label="Maksimum">
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={10}
                className={fieldClass}
                value={s.maxChoices}
                onChange={(e) => update({ maxChoices: Number(e.target.value) })}
              />
            )}
          </Labeled>
        </div>
      ) : null}
      <p className="mt-4 text-sm text-neutral-700">
        Tersedia {c.divisionCount} {l2} untuk dipilih.
      </p>
    </StepFrame>
  );
}

export function StepPindah({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <StepFrame
      title={`Pendaftar boleh ditempatkan di ${l2} yang tidak dipilihnya?`}
      hint="Bila ya, formulir menambahkan kotak “bersedia dipindahkan”, dan pendaftar yang bersedia bisa ditempatkan di luar pilihannya."
      illustration={<MoveArt />}
    >
      <OptionCards
        label="Penempatan di luar pilihan"
        value={s.allowRedirect ? 'ya' : 'tidak'}
        onChange={(v) => update({ allowRedirect: v === 'ya' })}
        options={[
          {
            value: 'tidak',
            label: 'Tidak',
            description: 'Pendaftar hanya ditempatkan di pilihannya.',
          },
          {
            value: 'ya',
            label: 'Ya, kalau pendaftar bersedia',
            description:
              'Ada kotak centang “bersedia dipindahkan” di formulir.',
          },
        ]}
      />
    </StepFrame>
  );
}

export function StepLampiran({ s, update }: StepProps) {
  const [draft, setDraft] = useState('');
  const toggle = (name: string) =>
    update({
      attachments: s.attachments.includes(name)
        ? s.attachments.filter((a) => a !== name)
        : [...s.attachments, name],
    });
  const [dupe, setDupe] = useState(false);
  const add = () => {
    const name = draft.trim();
    const existing = findAttachment(s.attachments, name);
    const preset = findAttachment(ATTACHMENT_PRESETS, name);
    setDupe(false);
    if (existing) {
      setDupe(true);
    } else if (name && s.attachments.length < 10) {
      // Samakan dengan preset bila hanya beda huruf besar/kecil.
      update({ attachments: [...s.attachments, preset ?? name] });
    }
    setDraft('');
  };
  const custom = s.attachments.filter(
    (a) => !(ATTACHMENT_PRESETS as readonly string[]).includes(a),
  );
  return (
    <StepFrame
      title="Persyaratan umum apa yang perlu dilampirkan?"
      hint="Setiap lampiran menjadi kolom tautan wajib di formulir (Google Drive, OneDrive, dan sejenisnya), bukan unggahan ke server."
      illustration={<LinksArt />}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lampiran">
        {[...ATTACHMENT_PRESETS, ...custom].map((name) => {
          const on = s.attachments.includes(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(name)}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                on
                  ? 'border-primary-400 bg-primary-400 text-neutral-50'
                  : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-300',
              )}
            >
              {name}
              {on &&
              !(ATTACHMENT_PRESETS as readonly string[]).includes(name) ? (
                <X className="size-3.5" />
              ) : null}
            </button>
          );
        })}
      </div>
      <form
        className="mt-5 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="Lampiran lain"
          className={fieldClass}
          placeholder="Lampiran lain, mis. Surat rekomendasi"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="submit"
          variant="dark_blue_outline"
          disabled={!draft.trim()}
        >
          Tambah
        </Button>
      </form>
      {dupe ? (
        <p role="alert" className="mt-3 text-sm text-danger-dark">
          Lampiran itu sudah ada (huruf besar/kecil dianggap sama).
        </p>
      ) : null}
      {s.attachments.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">
          Tanpa lampiran bila tidak ada yang dipilih.
        </p>
      ) : null}
    </StepFrame>
  );
}

export function StepKelompok({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <StepFrame
      title="Pertanyaan di formulir dikelompokkan bagaimana?"
      hint={`Berlaku untuk formulir dari templat. Bagian per ${l2} hanya muncul bagi pendaftar yang memilih ${l2} itu.`}
      illustration={<SectionsArt />}
    >
      <OptionCards
        label="Pengelompokan pertanyaan"
        value={s.grouping}
        onChange={(v) => update({ grouping: v })}
        options={[
          {
            value: 'per_divisi',
            label: `Satu bagian per ${l2}`,
            description: `Tiap bagian berisi pertanyaan khusus dan hanya tampil bila ${l2}nya dipilih.`,
          },
          {
            value: 'satu_bagian',
            label: 'Satu bagian saja',
            description:
              'Hanya pertanyaan umum; pertanyaan khusus bisa ditambah nanti di pembuat formulir.',
          },
        ]}
      />
    </StepFrame>
  );
}

export function StepForm({ s, update, c }: StepProps) {
  return (
    <StepFrame
      title="Pakai formulir yang mana?"
      hint="Identitas pendaftar diambil dari akun Anmategra, satu respons per akun, dan formulir memuat tepat satu pertanyaan pilihan tujuan."
    >
      <OptionCards
        label="Sumber formulir"
        value={s.formMode}
        onChange={(v) => update({ formMode: v })}
        options={[
          {
            value: 'template',
            label: 'Buat dari templat oprec',
            description:
              'Terisi dari jawabanmu di langkah sebelumnya: lampiran, pilihan tujuan, dan bagian per tujuan.',
          },
          {
            value: 'existing',
            label: 'Pakai formulir yang sudah ada',
            description:
              c.forms.length === 0
                ? 'Belum ada formulir kosong di periode ini.'
                : 'Formulir harus belum menerima jawaban. Pertanyaan pilihan tujuan ditambahkan sendiri di pembuat formulir.',
            disabled: c.forms.length === 0,
          },
        ]}
      />
      {s.formMode === 'template' ? (
        <div className="mt-6 max-w-md">
          <Labeled
            label="Judul formulir (opsional)"
            hint="Bila kosong, memakai “Pendaftaran” dan nama oprec."
          >
            {(id) => (
              <input
                id={id}
                className={fieldClass}
                maxLength={255}
                value={s.formTitle}
                onChange={(e) => update({ formTitle: e.target.value })}
              />
            )}
          </Labeled>
        </div>
      ) : (
        <div className="mt-6 max-w-md">
          <Labeled label="Formulir">
            {(id) => (
              <select
                id={id}
                className={fieldClass}
                value={s.existingFormId ?? ''}
                onChange={(e) =>
                  update({ existingFormId: e.target.value || null })
                }
              >
                <option value="">Pilih formulir…</option>
                {c.forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            )}
          </Labeled>
        </div>
      )}
    </StepFrame>
  );
}
