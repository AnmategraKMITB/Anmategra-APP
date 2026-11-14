'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { api } from '~/trpc/react';

import { type OprecBase } from '../status';
import {
  type WizardCtx,
  type WizardState,
  clampChoices,
} from '../wizard/model';
import { StepGelombang } from '../wizard/steps-dasar';
import { StepPilihan, StepSyarat } from '../wizard/steps-form';
import {
  StepAksesHasil,
  StepCloserec,
  StepGugur,
  StepKeputusan,
  StepMetode,
  StepPenilai,
  StepRilis,
  StepSumberNilai,
  StepTahap,
  StepVeto,
  StepVisibilitas,
} from '../wizard/steps-lanjut';
import { type StepProps } from '../wizard/steps-types';
import { CompactSteps, Labeled, Note, fieldClass } from '../wizard/ui';
import { AssessorTeam } from './assessor-team';
import {
  type OprecDetail,
  type SettingsDraft,
  type SettingsExtra,
  changesOf,
  draftFromDetail,
  draftProblem,
} from './model';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-neutral-1000">{title}</h2>
      {hint ? (
        <p className="mt-1 max-w-prose text-sm text-neutral-700">{hint}</p>
      ) : null}
      <div className="mt-5 grid gap-8">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold text-neutral-1000">{label}</span>
        <span className="mt-0.5 block text-sm text-neutral-700">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="max-w-xs">
      <Labeled label={label} hint={hint}>
        {(id) => (
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            className={fieldClass}
            value={Number.isNaN(value) ? '' : value}
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
        )}
      </Labeled>
    </div>
  );
}

/** Kapan tab Nilai terbuka, dari isian saat ini (bukan yang tersimpan). */
function assessmentHint(d: OprecDetail, s: WizardState, x: SettingsExtra) {
  if (x.allowEarlyAssessment)
    return 'Penilaian sudah terbuka untuk semua pendaftar.';
  if (s.useWaves)
    return 'Pendaftar tiap gelombang bisa dinilai setelah gelombangnya berakhir. Pendaftar yang masuk sebelum ada gelombang bisa dinilai setelah pendaftaran ditutup.';
  return d.status === 'closed'
    ? 'Pendaftaran sudah ditutup, jadi semua pendaftar bisa dinilai.'
    : 'Pendaftar bisa dinilai setelah pendaftaran ditutup lewat tombol "Tutup pendaftaran" di atas.';
}

/** Tab Pengaturan: jawaban wizard yang masih bisa diubah setelah oprec dibuat. */
export function SettingsView({
  recruitmentId,
  eventId,
  lembagaId,
  periodName,
  basePath,
  backHref,
  tabs,
}: {
  recruitmentId: string;
  eventId: string;
  lembagaId: string | null;
  periodName: string;
  basePath: OprecBase;
  backHref: string;
  tabs: ReactNode;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const detail = api.oprec.get.useQuery({ recruitmentId });
  const options = api.oprec.setupOptions.useQuery(
    { eventId },
    { staleTime: Infinity },
  );
  const update = api.oprec.update.useMutation();
  const replaceWaves = api.oprec.replaceWaves.useMutation();
  const replaceEligibility = api.oprec.replaceEligibility.useMutation();

  const [initial, setInitial] = useState<SettingsDraft | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (detail.data && !initial) {
      const d = draftFromDetail(detail.data);
      setInitial(d);
      setDraft(d);
    }
  }, [detail.data, initial]);

  if (detail.error) {
    return (
      <p role="alert" className="py-8 text-danger-dark">
        Pengaturan tidak bisa dimuat: {detail.error.message}
      </p>
    );
  }

  const d = detail.data;
  const labels = (options.data?.tree?.levelLabels ?? ['Bidang', 'Divisi']) as [
    string,
    string,
  ];
  const l2 = labels[1].toLowerCase();
  const c: WizardCtx = {
    eventId,
    eventName: periodName,
    lembagaId,
    labels,
    hasOrganogram: true,
    forms: [],
    divisionCount: d?.divisions.length ?? 0,
    unitName: (id) => d?.divisions.find((v) => v.unitId === id)?.unitName ?? '',
    hasPeople: () => true,
    hasHead: () => true,
  };

  const changes =
    initial && draft ? changesOf(initial, draft, lembagaId) : null;
  const dirty = !!(
    changes &&
    (changes.settings ?? changes.waves ?? changes.eligibility)
  );
  const problem = draft ? draftProblem(draft, c) : null;

  const patchS = (patch: Partial<WizardState>) => {
    setSaved(false);
    setDraft((prev) =>
      prev ? { ...prev, s: clampChoices({ ...prev.s, ...patch }) } : prev,
    );
  };
  const patchX = (patch: Partial<SettingsExtra>) => {
    setSaved(false);
    setDraft((prev) => (prev ? { ...prev, x: { ...prev.x, ...patch } } : prev));
  };

  const save = async () => {
    if (!changes || problem) return;
    setSaving(true);
    setError(null);
    let part = 'pengaturan';
    try {
      if (changes.settings) {
        await update.mutateAsync({ recruitmentId, settings: changes.settings });
      }
      part = 'gelombang';
      if (changes.waves) {
        await replaceWaves.mutateAsync({ recruitmentId, waves: changes.waves });
      }
      part = 'syarat pendaftar';
      if (changes.eligibility) {
        await replaceEligibility.mutateAsync({
          recruitmentId,
          ...changes.eligibility,
        });
      }
      const fresh = draftFromDetail(
        await utils.oprec.get.fetch({ recruitmentId }),
      );
      setInitial(fresh);
      setDraft(fresh);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(
        `Bagian ${part} belum tersimpan: ${e instanceof Error ? e.message : 'coba lagi.'}`,
      );
      await utils.oprec.get.invalidate({ recruitmentId });
    } finally {
      setSaving(false);
    }
  };

  const formHref = d ? `${basePath}/forms/${d.formId}` : '#';
  const kegiatanHref = backHref.replace(/\/oprec$/, '');

  return (
    <div className="py-6 sm:py-8">
      <header className="min-w-0">
        <Link
          href={backHref}
          className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          ← Kembali ke oprec
        </Link>
        <h1 className="mt-2 break-words text-2xl font-semibold text-neutral-1000 sm:text-[32px]">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          {d?.name ?? 'Memuat…'}
          {periodName ? ` · ${periodName}` : ''}. Jawaban setup yang masih bisa
          diubah setelah oprec dibuat.
        </p>
      </header>
      {tabs}

      {!d || !draft ? (
        <p className="mt-8 text-neutral-700">Memuat pengaturan…</p>
      ) : (
        <CompactSteps.Provider value={true}>
          <div className="mt-6 grid max-w-4xl gap-6 pb-28">
            <Section
              title="Status dan penilaian"
              hint="Status oprec diubah lewat tombol di atas: Buka pendaftaran, Tutup pendaftaran, atau Buka lagi pendaftaran untuk perpanjangan."
            >
              <div className="grid gap-4">
                <Note>{assessmentHint(d, draft.s, draft.x)}</Note>
                <Toggle
                  label="Buka penilaian sebelum pendaftaran ditutup"
                  description="Penilai bisa mulai mengisi tab Nilai untuk pendaftar yang sudah masuk, tanpa menunggu gelombang berakhir atau oprec ditutup."
                  checked={draft.x.allowEarlyAssessment}
                  onChange={(v) => patchX({ allowEarlyAssessment: v })}
                />
              </div>
            </Section>

            <Section
              title="Dasar dan jadwal"
              hint="Untuk perpanjangan, ubah tanggal berakhir gelombang atau tambahkan gelombang baru. Gelombang yang sudah punya pendaftar tidak bisa dihapus."
            >
              <div className="max-w-md">
                <Labeled label="Nama oprec">
                  {(id) => (
                    <input
                      id={id}
                      className={fieldClass}
                      value={draft.s.name}
                      onChange={(e) => patchS({ name: e.target.value })}
                    />
                  )}
                </Labeled>
              </div>
              <Steps s={draft.s} update={patchS} c={c} list={[StepGelombang]} />
              {d.status === 'closed' && draft.s.useWaves ? (
                <Note tone="warn">
                  Pendaftaran sedang ditutup. Setelah menambah gelombang, buka
                  lagi pendaftarannya lewat tombol di atas.
                </Note>
              ) : null}
            </Section>

            <Section title="Pendaftar dan pilihan">
              <Steps s={draft.s} update={patchS} c={c} list={[StepSyarat]} />
              <fieldset disabled={d.structureLocked} className="min-w-0">
                <Steps s={draft.s} update={patchS} c={c} list={[StepPilihan]} />
                {d.structureLocked ? (
                  <Note>
                    Jumlah pilihan dikunci karena sudah ada pendaftar, supaya
                    pilihan yang sudah dikirim tetap sah.
                  </Note>
                ) : null}
              </fieldset>
              <div>
                <h3 className="text-lg font-semibold text-neutral-1000">
                  {d.divisions.length} {l2} dibuka
                </h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {d.divisions.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-xl border border-neutral-400 px-4 py-3 text-sm"
                    >
                      <span className="block font-semibold text-neutral-1000">
                        {v.unitName}
                      </span>
                      <span className="text-neutral-700">
                        {v.positionTitle} · kuota{' '}
                        {v.quota > 0 ? v.quota : 'tanpa batas'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-neutral-700">
                  Kuota diatur di jabatan pada{' '}
                  <Link
                    href={`${kegiatanHref}/organogram`}
                    className="text-primary-400 underline-offset-2 hover:underline"
                  >
                    organogram
                  </Link>
                  . Penempatan di luar pilihan{' '}
                  {d.allowRedirect ? 'diizinkan' : 'tidak diizinkan'}; ini
                  ditentukan saat setup karena ikut membentuk formulir.
                </p>
              </div>
            </Section>

            <Section
              title="Penilaian"
              hint={
                <>
                  Kriteria penilaian diatur di panel Penilaian pada{' '}
                  <Link
                    href={formHref}
                    className="text-primary-400 underline-offset-2 hover:underline"
                  >
                    formulir
                  </Link>
                  . Mengubah cara status ditentukan akan menghitung ulang skor
                  dan status otomatis semua pendaftar.
                </>
              }
            >
              <Steps s={draft.s} update={patchS} c={c} list={[StepKeputusan]} />
              {draft.s.scoringMode === 'skor' ? (
                <>
                  <Steps
                    s={draft.s}
                    update={patchS}
                    c={c}
                    list={[StepMetode]}
                  />
                  {draft.s.statusMethod !== 'peringkat_kuota' ? (
                    <NumberField
                      label={
                        draft.s.statusMethod === 'ambang'
                          ? 'Ambang nilai (0–100)'
                          : 'Nilai minimum (0–100)'
                      }
                      value={draft.x.statusMinScore}
                      min={0}
                      max={100}
                      onChange={(n) => patchX({ statusMinScore: n })}
                    />
                  ) : null}
                  {draft.s.rubrics === 'keduanya' ? (
                    <Steps
                      s={draft.s}
                      update={patchS}
                      c={c}
                      list={[StepSumberNilai]}
                    />
                  ) : null}
                  {draft.s.rubrics === 'keduanya' &&
                  draft.s.scoreSource === 'gabungan' ? (
                    <NumberField
                      label="Bobot nilai umum (%)"
                      hint={`Sisanya, ${Number.isNaN(draft.x.weightUmum) ? '…' : 100 - draft.x.weightUmum}%, dari nilai ${l2}.`}
                      value={draft.x.weightUmum}
                      min={0}
                      max={100}
                      onChange={(n) => patchX({ weightUmum: n })}
                    />
                  ) : null}
                  <NumberField
                    label="Penilai minimum per berkas"
                    hint="Skor baru dihitung setelah sebanyak ini penilai mengisi; nilai beberapa penilai dirata-rata."
                    value={draft.x.minReviewers}
                    min={1}
                    max={5}
                    onChange={(n) => patchX({ minReviewers: n })}
                  />
                </>
              ) : null}
              <Steps
                s={draft.s}
                update={patchS}
                c={c}
                list={[StepPenilai, StepGugur, StepVeto]}
              />
              <Toggle
                label="Sembunyikan identitas pendaftar dari penilai"
                description="Penilai melihat kode pendaftar, bukan nama dan NIM. Admin oprec tetap melihat semuanya."
                checked={draft.x.blind}
                onChange={(v) => patchX({ blind: v })}
              />
            </Section>

            <Section
              title="Tim penilai"
              hint={`Ketua ${l2} ikut menilai sesuai jawaban "Siapa yang menilai pendaftar?". Tambahkan penilai lain dengan email atau NIM; tiap penilai masuk dengan akunnya sendiri.`}
            >
              <AssessorTeam
                recruitmentId={recruitmentId}
                divisions={d.divisions}
                headsAssess={d.assessorMode !== 'umum'}
              />
            </Section>

            <Section title="Penempatan dan hasil">
              <Steps
                s={draft.s}
                update={patchS}
                c={c}
                list={[
                  StepTahap,
                  StepVisibilitas,
                  StepAksesHasil,
                  StepRilis,
                  StepCloserec,
                ]}
              />
            </Section>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-400 bg-neutral-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex max-w-4xl flex-wrap items-center justify-between gap-3">
              <p
                role={error ? 'alert' : 'status'}
                className={
                  error || (dirty && problem)
                    ? 'text-sm text-danger-dark'
                    : 'text-sm text-neutral-700'
                }
              >
                {error ??
                  (dirty && problem
                    ? problem
                    : dirty
                      ? 'Ada perubahan yang belum disimpan.'
                      : saved
                        ? 'Perubahan tersimpan.'
                        : 'Belum ada perubahan.')}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!dirty || saving}
                  onClick={() => {
                    setDraft(initial);
                    setError(null);
                  }}
                >
                  Batalkan
                </Button>
                <Button
                  type="button"
                  variant="light_blue"
                  disabled={!dirty || !!problem || saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Menyimpan…' : 'Simpan perubahan'}
                </Button>
              </div>
            </div>
          </div>
        </CompactSteps.Provider>
      )}
    </div>
  );
}

/** Menampilkan beberapa langkah wizard berurutan dengan isian Pengaturan. */
function Steps({
  s,
  update,
  c,
  list,
}: {
  s: WizardState;
  update: StepProps['update'];
  c: WizardCtx;
  list: ((p: StepProps) => ReactNode)[];
}) {
  return (
    <>
      {list.map((Step, i) => (
        <Step key={i} s={s} update={update} c={c} trees={[]} sources={[]} />
      ))}
    </>
  );
}
