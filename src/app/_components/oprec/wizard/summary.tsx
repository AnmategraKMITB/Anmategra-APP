'use client';

import { Check, Pencil, TriangleAlert } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { ELIGIBILITY_ATTRIBUTE_LABELS } from '~/lib/oprec/eligibility';
import { cn } from '~/lib/utils';

import {
  GROUP_OF,
  OP_LABELS,
  type StepId,
  type WizardCtx,
  type WizardState,
  stepProblem,
} from './model';

const YES = (v: boolean) => (v ? 'Ya' : 'Tidak');

const TITLES: Record<StepId, (c: WizardCtx) => string> = {
  S1: () => 'Nama dan periode',
  S2: () => 'Badan sumber',
  S3: (c) => `${c.labels[0]} atau ${c.labels[1].toLowerCase()} yang dibuka`,
  S4: () => 'Gelombang',
  S5: () => 'Syarat pendaftar',
  S6: (c) => `Jumlah pilihan ${c.labels[1].toLowerCase()}`,
  S7: () => 'Penempatan di luar pilihan',
  S8: () => 'Lampiran wajib',
  S9: () => 'Pengelompokan pertanyaan',
  S10: () => 'Formulir',
  S11: () => 'Rubrik penilaian',
  S12: () => 'Cara memutuskan',
  S12a: () => 'Metode status',
  S12b: () => 'Sumber nilai',
  S13: () => 'Penilai',
  S14: () => 'Penilai umum',
  S15: () => 'Syarat gugur',
  S16: () => 'Keputusan akhir dan veto',
  S17: () => 'Pengelola oprec',
  S18: () => 'Tahap penempatan',
  S19: () => 'Visibilitas antar tujuan',
  S20: () => 'Akses menu Hasil',
  S21: () => 'Rilis ke pendaftar',
  S22: () => 'Closerec',
  S23: () => 'Kriteria penilaian',
};

/** Ringkasan jawaban satu langkah dalam kalimat pendek. */
export function describe(id: StepId, s: WizardState, c: WizardCtx): string {
  const l2 = c.labels[1].toLowerCase();
  switch (id) {
    case 'S1':
      return s.name.trim();
    case 'S2':
      return `${s.sourcePeriodIds.length} organogram`;
    case 'S3': {
      const names = Object.keys(s.divisions).map((u) => c.unitName(u));
      return names.length === 0
        ? 'Belum dipilih'
        : `${names.length} dipilih: ${names.slice(0, 4).join(', ')}${names.length > 4 ? `, +${names.length - 4} lagi` : ''}`;
    }
    case 'S4':
      return s.useWaves
        ? s.waves.map((w) => w.label || '?').join(', ')
        : 'Tanpa gelombang';
    case 'S5':
      return s.eligibility.enabled
        ? s.eligibility.rules
            .map(
              (r) =>
                `${ELIGIBILITY_ATTRIBUTE_LABELS[r.attribute]} ${OP_LABELS[r.op]} ${r.attribute === 'keanggotaan_lembaga' ? 'lembaga ini' : r.value}`,
            )
            .join(s.eligibility.match === 'all' ? ' dan ' : ' atau ')
        : 'Semua mahasiswa aktif';
    case 'S6':
      return s.minChoices === s.maxChoices
        ? `${s.minChoices} pilihan`
        : `${s.minChoices}–${s.maxChoices} pilihan`;
    case 'S7':
      return YES(s.allowRedirect);
    case 'S8':
      return s.attachments.length === 0
        ? 'Tanpa lampiran'
        : s.attachments.join(', ');
    case 'S9':
      return s.grouping === 'per_divisi'
        ? `Satu bagian per ${l2}`
        : 'Satu bagian saja';
    case 'S10':
      return s.formMode === 'template'
        ? 'Dibuat dari templat oprec'
        : (c.forms.find((f) => f.id === s.existingFormId)?.title ??
            'Formulir yang ada');
    case 'S11':
      return {
        keduanya: 'Umum dan per tujuan',
        divisi: 'Hanya per tujuan',
        umum: 'Hanya umum',
      }[s.rubrics];
    case 'S12':
      return s.scoringMode === 'skor'
        ? 'Dinilai dengan skor'
        : 'Langsung diputuskan';
    case 'S12a':
      return {
        peringkat_kuota_minimum: 'Peringkat dalam kuota dengan nilai minimum',
        peringkat_kuota: 'Peringkat dalam kuota',
        ambang: 'Ambang nilai',
      }[s.statusMethod];
    case 'S12b':
      return {
        gabungan: 'Gabungan berbobot',
        umum: 'Nilai umum',
        divisi: 'Nilai per tujuan',
      }[s.scoreSource];
    case 'S13':
      return {
        ketua: `Ketua ${l2}`,
        umum: 'Penilai umum',
        keduanya: `Penilai umum dan ketua ${l2}`,
      }[s.assessors];
    case 'S14':
      return s.generalAssessorUnitId
        ? c.unitName(s.generalAssessorUnitId)
        : 'Belum dipilih';
    case 'S15':
      return YES(s.hasGugur);
    case 'S16':
      return YES(s.veto);
    case 'S17':
      return {
        saya: 'Saya saja',
        orang: `Saya dan ${s.managerIdentifiers.length} orang`,
        level: s.managerUnitId
          ? `Saya dan ${c.unitName(s.managerUnitId)}`
          : 'Saya dan bagian tertentu',
        ketua: `Hanya ketua ${l2}`,
      }[s.managers];
    case 'S18':
      return s.staged ? 'Bertahap per pilihan' : 'Semua pilihan sekaligus';
    case 'S19':
      return s.visibility === 'ya' ? 'Boleh dilihat' : 'Tidak boleh';
    case 'S20':
      return {
        admin: 'Admin oprec saja',
        admin_ketua: `Admin dan ketua ${l2}`,
        semua: 'Semua pengelola',
      }[s.resultsAccess];
    case 'S21':
      return s.releaseToApplicants ? 'Ya, saat admin merilis' : 'Tidak';
    case 'S22':
      return YES(s.closerec);
    case 'S23': {
      const n = Object.values(s.criteria).reduce(
        (a, l) => a + l.filter((k) => k.name.trim()).length,
        0,
      );
      return n === 0 ? 'Belum ada kriteria' : `${n} kriteria`;
    }
  }
}

/** Layar ringkasan: semua jawaban per kelompok, bisa diubah per langkah sebelum membuat oprec. */
export function Summary({
  steps,
  s,
  c,
  onEdit,
  onCreate,
  creating,
  error,
}: {
  steps: StepId[];
  s: WizardState;
  c: WizardCtx;
  onEdit: (id: StepId) => void;
  onCreate: () => void;
  creating: boolean;
  error: string | null;
}) {
  const problems = steps.flatMap((id) => {
    const p = stepProblem(id, s, c);
    return p ? [{ id, message: p }] : [];
  });
  const groups = [...new Set(steps.map((id) => GROUP_OF[id]))];
  return (
    <div>
      <h2 className="text-2xl font-semibold text-neutral-1000 sm:text-[28px] sm:leading-9">
        Periksa dulu sebelum dibuat
      </h2>
      <p className="mt-2 max-w-prose text-neutral-700">
        Oprec dibuat berstatus draf. Pendaftaran baru dibuka setelah formulir
        terbit dan kamu membukanya.
      </p>

      {problems.length > 0 ? (
        <div
          role="alert"
          className="mt-6 rounded-xl bg-warning-light px-4 py-3 text-sm text-neutral-1000"
        >
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" /> Beberapa langkah belum lengkap
          </p>
          <ul className="mt-1 list-disc pl-6">
            {problems.map((p) => (
              <li key={p.id}>
                {TITLES[p.id](c)}: {p.message}{' '}
                <button
                  type="button"
                  onClick={() => onEdit(p.id)}
                  className="font-semibold text-primary-400 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  Perbaiki
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {groups.map((group) => (
          <section
            key={group}
            className="overflow-hidden rounded-[20px] border border-neutral-400 bg-neutral-50"
          >
            <h3 className="border-b border-neutral-400 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700">
              {group}
            </h3>
            <ul className="divide-y divide-neutral-400">
              {steps
                .filter((id) => GROUP_OF[id] === group)
                .map((id) => {
                  const bad = problems.some((p) => p.id === id);
                  return (
                    <li
                      key={id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-700">
                          {TITLES[id](c)}
                        </p>
                        <p
                          className={cn(
                            'break-words font-medium',
                            bad ? 'text-danger-dark' : 'text-neutral-1000',
                          )}
                        >
                          {describe(id, s, c)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Ubah ${TITLES[id](c)}`}
                        onClick={() => onEdit(id)}
                      >
                        <Pencil /> Ubah
                      </Button>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
        >
          Oprec belum bisa dibuat: {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="light_blue"
          size="lg"
          disabled={problems.length > 0 || creating}
          onClick={onCreate}
        >
          <Check /> {creating ? 'Membuat…' : 'Buat oprec'}
        </Button>
      </div>
    </div>
  );
}
