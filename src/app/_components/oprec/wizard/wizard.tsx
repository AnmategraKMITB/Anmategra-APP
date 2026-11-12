'use client';

import { ArrowLeft, ArrowRight, FastForward } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { api } from '~/trpc/react';

import { type OprecBase } from '../status';
import {
  GROUP_OF,
  type PresetId,
  STEP_IDS,
  type SetupTree,
  type StepId,
  type WizardCtx,
  type WizardState,
  buildInput,
  defaultState,
  firstInvalidStep,
  restoreState,
  stepProblem,
  visibleSteps,
} from './model';
import { PresetScreen } from './preset-screen';
import { PRESETS } from './presets';
import { StepGelombang, StepNama, StepSumber, StepTujuan } from './steps-dasar';
import {
  StepForm,
  StepKelompok,
  StepLampiran,
  StepPilihan,
  StepPindah,
  StepSyarat,
} from './steps-form';
import {
  StepAkses,
  StepAksesHasil,
  StepCloserec,
  StepGugur,
  StepKeputusan,
  StepKriteria,
  StepMetode,
  StepPenilai,
  StepPenilaiUmum,
  StepRilis,
  StepRubrik,
  StepSumberNilai,
  StepTahap,
  StepVeto,
  StepVisibilitas,
} from './steps-lanjut';
import { type StepProps } from './steps-types';
import { Done, type GrantResult } from './success';
import { Summary } from './summary';

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactNode> = {
  S1: StepNama,
  S2: StepSumber,
  S3: StepTujuan,
  S4: StepGelombang,
  S5: StepSyarat,
  S6: StepPilihan,
  S7: StepPindah,
  S8: StepLampiran,
  S9: StepKelompok,
  S10: StepForm,
  S11: StepRubrik,
  S12: StepKeputusan,
  S12a: StepMetode,
  S12b: StepSumberNilai,
  S13: StepPenilai,
  S14: StepPenilaiUmum,
  S15: StepGugur,
  S16: StepVeto,
  S17: StepAkses,
  S18: StepTahap,
  S19: StepVisibilitas,
  S20: StepAksesHasil,
  S21: StepRilis,
  S22: StepCloserec,
  S23: StepKriteria,
};

type Phase = 'preset' | 'steps' | 'summary' | 'done';

/** Wizard setup oprec: satu pertanyaan per layar, bawaan terpilih, ringkasan di akhir. */
export function SetupWizard({
  eventId,
  eventName,
  lembagaId,
  basePath,
}: {
  eventId: string;
  eventName: string;
  lembagaId: string | null;
  basePath: OprecBase;
}) {
  const [s, setS] = useState<WizardState>(() =>
    defaultState(eventName, eventId),
  );
  const [current, setCurrent] = useState<StepId>('S1');
  const [phase, setPhase] = useState<Phase>('preset');
  const [created, setCreated] = useState<{
    recruitmentId: string;
    formId: string;
  } | null>(null);
  const [grants, setGrants] = useState<GrantResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'saving' | 'saved' | 'failed'
  >('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<WizardState>) =>
    setS((prev) => ({ ...prev, ...patch }));

  const applyPreset = (id: PresetId) => {
    const preset = PRESETS.find((item) => item.id === id);
    setS((prev) => ({
      ...prev,
      ...(preset?.patch ?? {}),
      preset: id,
    }));
    setCurrent('S1');
    setPhase('steps');
  };

  const own = api.oprec.setupOptions.useQuery({ eventId });
  const extraIds = s.sourcePeriodIds.filter((id) => id !== eventId);
  const extras = api.useQueries((t) =>
    extraIds.map((id) => t.oprec.setupOptions({ eventId, sourcePeriodId: id })),
  );
  const draft = api.oprec.setupDraftGet.useQuery(
    { eventId },
    { refetchOnWindowFocus: false, staleTime: Infinity },
  );
  const saveDraft = api.oprec.setupDraftSave.useMutation();
  const createMutation = api.oprec.createFromSetup.useMutation();
  const utils = api.useUtils();

  const sources = own.data?.sources ?? [];
  const extrasKey = extras.map((e) => e.dataUpdatedAt).join('|');
  const extraKey = extraIds.join('|');
  const trees = useMemo(() => {
    const list: StepProps['trees'] = [];
    if (own.data) {
      list.push({
        periodId: eventId,
        name: sources.find((x) => x.periodId === eventId)?.name ?? eventName,
        tree: own.data.tree,
      });
    }
    extraIds.forEach((id, i) => {
      const d = extras[i]?.data;
      if (d) {
        list.push({
          periodId: id,
          name: `${sources.find((x) => x.periodId === id)?.lembagaName ?? ''} · ${sources.find((x) => x.periodId === id)?.name ?? ''}`,
          tree: d.tree,
        });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own.data, extrasKey, extraKey]);

  const unitMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of trees)
      for (const u of t.tree?.units ?? []) m.set(u.id, u.name);
    return m;
  }, [trees]);

  const staffed = new Set<string>();
  const headed = new Set<string>();
  for (const t of trees) {
    t.tree?.staffedUnitIds.forEach((u) => staffed.add(u));
    t.tree?.headedUnitIds.forEach((u) => headed.add(u));
  }

  const labels = (own.data?.tree?.levelLabels ?? ['Bidang', 'Divisi']) as [
    string,
    string,
  ];
  const c: WizardCtx = {
    eventId,
    eventName,
    lembagaId,
    labels,
    hasOrganogram: trees.some((t) => t.tree !== null),
    forms: own.data?.forms ?? [],
    divisionCount: Object.keys(s.divisions).length,
    unitName: (id) => unitMap.get(id) ?? 'Bagian',
    hasPeople: (id) => staffed.has(id),
    hasHead: (id) => headed.has(id),
  };

  const steps = visibleSteps(s, { hasMultipleSources: sources.length > 1 });
  const index = Math.max(0, steps.indexOf(current));
  const problem = stepProblem(current, s, c);

  // Pulihkan draf sekali saat dibuka (langkah, jawaban, dan fase).
  useEffect(() => {
    if (restored || draft.isLoading) return;
    setRestored(true);
    if (!draft.data) return;
    const { state, remapped } = restoreState(
      defaultState(eventName, eventId),
      draft.data.state,
    );
    setS(state);
    if ((STEP_IDS as readonly string[]).includes(draft.data.step)) {
      setCurrent(draft.data.step as StepId);
    }
    setPhase(draft.data.phase === 'summary' ? 'summary' : 'steps');
    setNotice(
      remapped > 0
        ? `${remapped} kriteria jenis "gugur otomatis" dari draf lama diubah menjadi "gugur manual".`
        : 'Draf sebelumnya dipulihkan.',
    );
  }, [restored, draft.isLoading, draft.data, eventId, eventName]);

  // Simpan otomatis tiap pindah langkah; kegagalan tidak memblokir pengguna.
  useEffect(() => {
    if (!restored || phase === 'preset' || phase === 'done') return;
    setSaveStatus('saving');
    saveDraft.mutate(
      {
        eventId,
        state: JSON.parse(JSON.stringify(s)) as Record<string, unknown>,
        step: current,
        phase,
      },
      {
        onSuccess: () => setSaveStatus('saved'),
        onError: () => setSaveStatus('failed'),
      },
    );
    // Hanya saat langkah/fase berganti, bukan tiap ketikan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, phase, restored]);

  // Pindah langkah: fokus ke judul supaya pembaca layar dan keyboard tahu konteksnya.
  useEffect(() => {
    frame.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [current, phase]);

  const goto = (id: StepId) => {
    setPhase('steps');
    setCurrent(id);
  };
  const next = () => {
    const to = steps[index + 1];
    if (to) setCurrent(to);
    else skipRest();
  };
  const back = () => {
    if (phase === 'summary') {
      setPhase('steps');
      setCurrent(steps[steps.length - 1]!);
    } else if (index > 0) setCurrent(steps[index - 1]!);
  };

  // Lewati sisa dengan bawaan hanya bila semua langkah (juga yang dilewati) lolos.
  const skipRest = () => {
    const bad = firstInvalidStep(steps, s, c);
    if (bad) {
      setCurrent(bad.id);
      setNotice(`Langkah ini perlu dilengkapi dulu: ${bad.problem}`);
      return;
    }
    setNotice(null);
    setPhase('summary');
  };

  const create = async () => {
    setError(null);
    try {
      const res = await createMutation.mutateAsync(buildInput(s, c));
      // Akses pengelola diberikan server dalam transaksi yang sama dengan oprec.
      const results: GrantResult[] = res.managers.map((m) => ({
        identifier: m.name ? `${m.name} (${m.email})` : m.email,
        ok: true,
      }));
      await utils.oprec.list.invalidate();
      setGrants(results);
      setCreated(res);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    }
  };

  if (own.isError) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
      >
        Bahan setup belum bisa dimuat: {own.error.message}
      </p>
    );
  }
  if (!own.data) {
    return (
      <p role="status" className="py-10 text-center text-neutral-700">
        Memuat organogram dan formulir…
      </p>
    );
  }

  const Step = STEP_COMPONENTS[current];
  const total = steps.length;
  const percent = phase === 'steps' ? Math.round((index / total) * 100) : 100;
  const props: StepProps = { s, update, c, trees, sources };

  return (
    <div>
      {phase !== 'done' && phase !== 'preset' ? (
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-700">
            <span className="font-semibold text-primary-400">
              {phase === 'summary' ? 'Ringkasan' : GROUP_OF[current]}
            </span>
            <div className="flex items-center gap-3">
              <span>
                {phase === 'summary'
                  ? `${total} langkah`
                  : `Langkah ${index + 1} dari ${total}`}
              </span>
              <button
                type="button"
                onClick={() => setPhase('preset')}
                className="text-xs font-semibold text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                Ganti preset
              </button>
            </div>
          </div>
          <div
            role="progressbar"
            aria-label="Kemajuan setup"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"
          >
            <div
              className="h-full rounded-full bg-primary-400 transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </header>
      ) : null}

      {notice && phase !== 'done' && phase !== 'preset' ? (
        <p role="status" className="mb-4 text-sm text-neutral-700">
          {notice}
        </p>
      ) : null}
      {phase !== 'done' && phase !== 'preset' && saveStatus !== 'idle' ? (
        <p
          role="status"
          className={`mb-4 text-xs ${saveStatus === 'failed' ? 'text-danger-dark' : 'text-neutral-600'}`}
        >
          {saveStatus === 'saving'
            ? 'Menyimpan draf…'
            : saveStatus === 'saved'
              ? 'Draf tersimpan'
              : 'Draf gagal tersimpan. Isian tetap aman di layar ini; coba pindah langkah lagi.'}
        </p>
      ) : null}

      <div ref={frame} tabIndex={-1} className="outline-none">
        {phase === 'preset' ? (
          <PresetScreen
            current={s.preset}
            onPick={applyPreset}
            cancelHref={`${basePath}/kegiatan/${eventId}/oprec`}
          />
        ) : phase === 'steps' ? (
          <>
            <Step {...props} />
            {problem ? (
              <p role="status" className="mt-6 text-sm text-danger-dark">
                {problem}
              </p>
            ) : null}
          </>
        ) : phase === 'summary' ? (
          <Summary
            steps={steps}
            s={s}
            c={c}
            onEdit={goto}
            onCreate={create}
            creating={createMutation.isPending}
            error={error}
          />
        ) : created ? (
          <Done
            created={created}
            grants={grants}
            eventId={eventId}
            basePath={basePath}
          />
        ) : null}
      </div>

      {phase !== 'done' && phase !== 'preset' ? (
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-400 pt-5">
          <div className="flex items-center gap-2">
            {phase === 'summary' || index > 0 ? (
              <Button type="button" variant="dark_blue_outline" onClick={back}>
                <ArrowLeft /> Kembali
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPhase('preset')}
                >
                  Pilih preset
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`${basePath}/kegiatan/${eventId}/oprec`}>
                    Batal
                  </Link>
                </Button>
              </>
            )}
          </div>
          {phase === 'steps' ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              {index < total - 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!!problem}
                  onClick={skipRest}
                  title="Lewati sisa pertanyaan dengan jawaban bawaan dan periksa ringkasan"
                >
                  <FastForward /> Pakai bawaan untuk sisanya
                </Button>
              ) : null}
              <Button
                type="button"
                variant="dark_blue"
                disabled={!!problem}
                onClick={next}
              >
                {index === total - 1 ? 'Periksa ringkasan' : 'Lanjut'}{' '}
                <ArrowRight />
              </Button>
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

export type { SetupTree };
