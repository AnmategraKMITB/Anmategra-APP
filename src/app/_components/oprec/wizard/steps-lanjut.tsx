'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '~/components/ui/button';

import {
  EyeArt,
  InboxArt,
  PeopleArt,
  ScoreArt,
  SectionsArt,
} from './illustrations';
import { type CriterionDraft, type WizardState } from './model';
import { type StepProps } from './steps-types';
import {
  Labeled,
  LaterNote,
  type Option,
  OptionCards,
  StepFrame,
  fieldClass,
} from './ui';

/** Satu layar pilihan tunggal dengan catatan "berlaku di fase berikutnya". */
function Choice<T extends string>({
  title,
  hint,
  art,
  label,
  value,
  options,
  onChange,
  later = false,
  children,
}: {
  title: string;
  hint?: string;
  art?: ReactNode;
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  later?: boolean;
  children?: ReactNode;
}) {
  return (
    <StepFrame title={title} hint={hint} illustration={art}>
      <OptionCards
        label={label}
        value={value}
        options={options}
        onChange={onChange}
      />
      {children}
      {later ? <LaterNote /> : null}
    </StepFrame>
  );
}

export function StepRubrik({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      title="Pertanyaan dan penilaian apa yang dipakai?"
      hint="Menentukan rubrik penilaian: tingkat pendaftar (umum), per pilihan, atau keduanya."
      art={<ScoreArt />}
      label="Rubrik penilaian"
      value={s.rubrics}
      onChange={(v) => update({ rubrics: v })}
      options={[
        {
          value: 'keduanya',
          label: 'Keduanya',
          description: `Penilaian umum untuk semua berkas dan penilaian per ${l2}.`,
        },
        {
          value: 'divisi',
          label: `Hanya per ${l2}`,
          description: `Tiap ${l2} menilai pendaftar yang memilihnya.`,
        },
        {
          value: 'umum',
          label: 'Hanya umum',
          description: 'Satu penilaian untuk semua pendaftar.',
        },
      ]}
    />
  );
}

export function StepKeputusan({ s, update }: StepProps) {
  return (
    <Choice
      title="Bagaimana pendaftar diputuskan?"
      hint="Dengan skor, status tiap pilihan dihitung otomatis dan bisa diubah manual dengan alasan. Tanpa skor, semua keputusan manual; semua tindakan tetap dicatat."
      art={<ScoreArt />}
      label="Cara memutuskan"
      value={s.scoringMode}
      onChange={(v) => update({ scoringMode: v })}
      options={[
        {
          value: 'skor',
          label: 'Dinilai dengan skor',
          description:
            'Status otomatis dari nilai; perubahan manual wajib beralasan.',
        },
        {
          value: 'keputusan_langsung',
          label: 'Langsung diputuskan tanpa skor',
          description: 'Keputusan manual oleh yang berwenang.',
        },
      ]}
    />
  );
}

export function StepMetode({ s, update }: StepProps) {
  return (
    <Choice
      title="Status otomatis ditentukan dengan cara apa?"
      hint="Bisa diubah lagi di pengaturan oprec."
      art={<ScoreArt />}
      label="Metode status"
      value={s.statusMethod}
      onChange={(v) => update({ statusMethod: v })}
      options={[
        {
          value: 'peringkat_kuota_minimum',
          label: 'Peringkat dalam kuota dengan nilai minimum',
          description:
            'Yang teratas sebanyak kuota dan tidak di bawah nilai minimum lolos.',
        },
        {
          value: 'peringkat_kuota',
          label: 'Peringkat dalam kuota',
          description: 'Yang teratas sebanyak kuota lolos.',
        },
        {
          value: 'ambang',
          label: 'Ambang nilai',
          description: 'Nilai di atas ambang lolos, di bawahnya tidak.',
        },
      ]}
    />
  );
}

export function StepSumberNilai({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      title="Nilai mana yang dipakai untuk status?"
      hint="Bobot gabungan diatur di langkah kriteria dan ikatan, nanti."
      art={<ScoreArt />}
      label="Sumber nilai"
      value={s.scoreSource}
      onChange={(v) => update({ scoreSource: v })}
      options={[
        {
          value: 'gabungan',
          label: 'Gabungan berbobot',
          description: `Nilai umum dan nilai ${l2} digabung.`,
        },
        { value: 'umum', label: 'Nilai umum' },
        { value: 'divisi', label: `Nilai ${l2}` },
      ]}
    />
  );
}

export function StepPenilai({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      title="Siapa yang menilai pendaftar?"
      hint="Penilai umum adalah satu kelompok untuk semua berkas."
      art={<PeopleArt />}
      label="Penilai"
      value={s.assessors}
      onChange={(v) => update({ assessors: v })}
      options={[
        { value: 'ketua', label: `Ketua ${l2} masing-masing` },
        { value: 'umum', label: 'Penilai umum' },
        { value: 'keduanya', label: 'Keduanya' },
      ]}
    />
  );
}

export function StepPenilaiUmum({ s, update, trees, c }: StepProps) {
  const units = trees.flatMap((t) => t.tree?.units ?? []);
  return (
    <StepFrame
      title={`${c.labels[0]} atau ${c.labels[1].toLowerCase()} mana yang jadi penilai umum?`}
      hint="Pilih dari organogram, mis. HR atau Administrasi."
      illustration={<PeopleArt />}
    >
      <div className="max-w-md">
        <Labeled label="Bagian penilai umum">
          {(id) => (
            <select
              id={id}
              className={fieldClass}
              value={s.generalAssessorUnitId ?? ''}
              onChange={(e) =>
                update({ generalAssessorUnitId: e.target.value || null })
              }
            >
              <option value="">Pilih bagian…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </Labeled>
      </div>
    </StepFrame>
  );
}

export function StepGugur({ s, update }: StepProps) {
  return (
    <Choice
      title="Ada syarat gugur?"
      hint="Contoh: “bersedia = Tidak” gugur otomatis, atau twibbon diperiksa penilai. Kriteria gugur diikat ke pertanyaan di langkah ikatan."
      art={<ScoreArt />}
      label="Syarat gugur"
      value={s.hasGugur ? 'ya' : 'tidak'}
      onChange={(v) => update({ hasGugur: v === 'ya' })}
      options={[
        { value: 'tidak', label: 'Tidak' },
        {
          value: 'ya',
          label: 'Ya',
          description: 'Tambahkan kriteria jenis gugur di langkah kriteria.',
        },
      ]}
    />
  );
}

export function StepVeto({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      later
      title={`Keputusan akhir dan hak veto ada di ketua ${l2}?`}
      art={<PeopleArt />}
      label="Keputusan akhir"
      value={s.veto ? 'ya' : 'tidak'}
      onChange={(v) => update({ veto: v === 'ya' })}
      options={[
        {
          value: 'ya',
          label: 'Ya',
          description: `Ketua ${l2} memutuskan dan bisa memveto penempatan.`,
        },
        {
          value: 'tidak',
          label: 'Tidak',
          description: 'Keputusan ada pada admin oprec.',
        },
      ]}
    />
  );
}

export function StepKriteria({ s, update, trees, c }: StepProps) {
  const unitName = c.unitName;
  const slots: { key: string; label: string }[] = [
    ...(s.rubrics !== 'divisi' ? [{ key: 'umum', label: 'Umum' }] : []),
    ...(s.rubrics !== 'umum'
      ? Object.keys(s.divisions).map((id) => ({ key: id, label: unitName(id) }))
      : []),
  ];
  void trees;
  const setSlot = (key: string, list: CriterionDraft[]) =>
    update({ criteria: { ...s.criteria, [key]: list } });
  return (
    <StepFrame
      title="Kriteria apa saja yang dinilai?"
      hint="Slot dibuat otomatis: satu untuk penilaian umum dan satu per tujuan yang dibuka. Boleh dikosongkan dan diisi nanti. Aturan gugur otomatis diisi di tab Penilaian setelah formulir jadi, sebelum pendaftaran dibuka."
      illustration={<SectionsArt />}
    >
      <div className="grid gap-3">
        {slots.map((slot) => (
          <Slot
            key={slot.key}
            label={slot.label}
            list={s.criteria[slot.key] ?? []}
            onChange={(list) => setSlot(slot.key, list)}
          />
        ))}
      </div>
    </StepFrame>
  );
}

function Slot({
  label,
  list,
  onChange,
}: {
  label: string;
  list: CriterionDraft[];
  onChange: (list: CriterionDraft[]) => void;
}) {
  const total = list
    .filter((k) => k.kind === 'skor')
    .reduce((n, k) => n + k.weight, 0);
  const hasScore = list.some((k) => k.kind === 'skor');
  const set = (i: number, patch: Partial<CriterionDraft>) =>
    onChange(list.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  return (
    <section className="rounded-[20px] border border-neutral-400 bg-neutral-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-neutral-1000">{label}</h3>
        <Button
          type="button"
          variant="dark_blue_outline"
          size="sm"
          onClick={() =>
            onChange([...list, { name: '', kind: 'skor', weight: 0 }])
          }
        >
          <Plus /> Tambah kriteria
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-700">Belum ada kriteria.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {list.map((k, i) => (
            <li
              key={i}
              className="grid gap-2 sm:grid-cols-[1fr_9.5rem_5rem_auto] sm:items-center"
            >
              <input
                aria-label="Nama kriteria"
                className={fieldClass}
                placeholder="Nama kriteria"
                value={k.name}
                onChange={(e) => set(i, { name: e.target.value })}
              />
              <select
                aria-label="Jenis kriteria"
                className={fieldClass}
                value={k.kind}
                onChange={(e) =>
                  set(i, { kind: e.target.value as CriterionDraft['kind'] })
                }
              >
                <option value="skor">Skor</option>
                <option value="gugur_otomatis">Gugur otomatis</option>
                <option value="gugur_manual">Gugur manual</option>
              </select>
              <input
                aria-label="Bobot (persen)"
                type="number"
                min={0}
                max={100}
                className={fieldClass}
                disabled={k.kind !== 'skor'}
                value={k.kind === 'skor' ? k.weight : ''}
                placeholder="Bobot"
                onChange={(e) => set(i, { weight: Number(e.target.value) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus kriteria ${k.name || i + 1}`}
                onClick={() => onChange(list.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {hasScore && total !== 100 ? (
        <p className="mt-2 text-sm text-neutral-700">
          Total bobot {total}%. Idealnya 100%, tetapi tidak menghalangi.
        </p>
      ) : null}
    </section>
  );
}

export function StepAkses({ s, update, trees, c }: StepProps) {
  const [draft, setDraft] = useState('');
  const units = trees.flatMap((t) => t.tree?.units ?? []);
  const l2 = c.labels[1].toLowerCase();
  const add = () => {
    const v = draft.trim();
    if (v && !s.managerIdentifiers.includes(v)) {
      update({ managerIdentifiers: [...s.managerIdentifiers, v] });
    }
    setDraft('');
  };
  return (
    <StepFrame
      title="Siapa yang bisa mengatur oprec ini?"
      hint="Pemilik dan admin lembaga selalu bisa. Orang tambahan diberi akses khusus oprec, bukan admin penuh."
      illustration={<PeopleArt />}
    >
      <OptionCards
        label="Pengelola oprec"
        value={s.managers}
        onChange={(v) => update({ managers: v })}
        options={[
          { value: 'saya', label: 'Saya saja' },
          {
            value: 'orang',
            label: 'Saya dan orang tertentu',
            description:
              'Masukkan email atau NIM; akses diberikan setelah oprec dibuat.',
          },
          {
            value: 'level',
            label: `Saya dan ${l2} tertentu`,
            description:
              'Tersimpan sebagai jawaban; akses per bagian aktif di fase berikutnya.',
          },
          {
            value: 'ketua',
            label: `Hanya ketua ${l2}`,
            description: 'Tersimpan sebagai jawaban; aktif di fase berikutnya.',
          },
        ]}
      />
      {s.managers === 'orang' ? (
        <div className="mt-6 max-w-md">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              aria-label="Email atau NIM"
              className={fieldClass}
              placeholder="Email atau NIM"
              value={draft}
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
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.managerIdentifiers.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary-100 py-1 pl-3 pr-1 text-sm font-medium text-primary-400"
              >
                {id}
                <button
                  type="button"
                  aria-label={`Hapus ${id}`}
                  className="rounded-full p-1 hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  onClick={() =>
                    update({
                      managerIdentifiers: s.managerIdentifiers.filter(
                        (x) => x !== id,
                      ),
                    })
                  }
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {s.managers === 'level' ? (
        <div className="mt-6 max-w-md">
          <Labeled label="Bagian">
            {(id) => (
              <select
                id={id}
                className={fieldClass}
                value={s.managerUnitId ?? ''}
                onChange={(e) =>
                  update({ managerUnitId: e.target.value || null })
                }
              >
                <option value="">Pilih bagian…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
          </Labeled>
        </div>
      ) : null}
    </StepFrame>
  );
}

export function StepTahap({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      later
      title="Penempatan dikerjakan bertahap per pilihan?"
      hint={`Bila ya, pilihan 1 diproses lebih dulu, lalu pilihan 2 dan 3; tahap tiap ${l2} bergeser otomatis begitu semua pendaftarnya sudah diputuskan. Koordinasi antar ${l2} dilakukan di luar Anmategra.`}
      art={<SectionsArt />}
      label="Tahap penempatan"
      value={s.staged ? 'ya' : 'tidak'}
      onChange={(v) => update({ staged: v === 'ya' })}
      options={[
        { value: 'ya', label: 'Ya, bertahap' },
        { value: 'tidak', label: 'Tidak, semua pilihan sekaligus' },
      ]}
    />
  );
}

export function StepVisibilitas({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      title={`${c.labels[1]} boleh melihat pendaftar yang sudah diterima ${l2} lain?`}
      hint="Hanya untuk dilihat, supaya negosiasi antar tujuan lebih mudah."
      art={<EyeArt />}
      label="Visibilitas antar tujuan"
      value={s.visibility}
      onChange={(v) => update({ visibility: v })}
      options={[
        { value: 'tidak', label: 'Tidak untuk semua' },
        {
          value: 'ya',
          label: 'Ya untuk semua',
          description: 'Pengecualian per bagian bisa diatur nanti.',
        },
      ]}
    />
  );
}

export function StepAksesHasil({ s, update, c }: StepProps) {
  const l2 = c.labels[1].toLowerCase();
  return (
    <Choice
      title="Siapa yang bisa membuka menu Hasil?"
      hint="Menu Hasil memuat status akhir dan alasan gugur; alasan sensitif tidak ikut diekspor."
      art={<InboxArt />}
      label="Akses menu Hasil"
      value={s.resultsAccess}
      onChange={(v: WizardState['resultsAccess']) =>
        update({ resultsAccess: v })
      }
      options={[
        { value: 'admin_ketua', label: `Admin dan ketua ${l2}` },
        { value: 'admin', label: 'Admin oprec saja' },
        { value: 'semua', label: 'Semua yang bisa mengatur oprec' },
      ]}
    />
  );
}

export function StepRilis({ s, update }: StepProps) {
  return (
    <Choice
      title="Hasil ditampilkan ke pendaftar di Anmategra?"
      hint="Pendaftar hanya melihat “diterima” atau “tidak diterima”, tanpa nilai maupun alasan."
      art={<InboxArt />}
      label="Rilis hasil"
      value={s.releaseToApplicants ? 'ya' : 'tidak'}
      onChange={(v) => update({ releaseToApplicants: v === 'ya' })}
      options={[
        { value: 'ya', label: 'Ya, saat admin merilis' },
        { value: 'tidak', label: 'Tidak, diumumkan sendiri' },
      ]}
    />
  );
}

export function StepCloserec({ s, update }: StepProps) {
  return (
    <Choice
      later
      title="Ada jalur closerec?"
      hint="Closerec: anggota diajak langsung tanpa mendaftar. Tidak memengaruhi kuota oprec."
      art={<PeopleArt />}
      label="Closerec"
      value={s.closerec ? 'ya' : 'tidak'}
      onChange={(v) => update({ closerec: v === 'ya' })}
      options={[
        { value: 'ya', label: 'Ya' },
        { value: 'tidak', label: 'Tidak' },
      ]}
    />
  );
}
