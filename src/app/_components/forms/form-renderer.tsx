'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { computeVisibility, pickEnding } from '~/lib/forms/conditions';
import { cn } from '~/lib/utils';
import { isAllowedImageHost } from '~/server/api/types/form.constants';
import type {
  FormSettings,
  FormTheme,
  FormWelcome,
} from '~/server/api/types/form.type';

import { type RendererField, validatePage } from './form-validate';
import { HEX_COLOR } from './model';
import { AnswerInput } from './renderer-inputs';
import { richTextToPlain } from './rich-text';
import { RichText } from './rich-text-view';
import { type SubmitResult, classifySubmitResult } from './submit-payload';

export type RendererSection = {
  id: string;
  title: string;
  description: string | null;
  condition?: unknown;
};
export type RendererFieldFull = RendererField & {
  description: string | null;
  sectionId: string | null;
  condition?: unknown;
  image?: { url: string; alt?: string | null } | null;
};
export type RendererEnding = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  condition?: unknown;
};
export type RendererForm = {
  id?: string;
  closesAt?: Date | null;
  title: string;
  description: string | null;
  settings: FormSettings;
  theme: FormTheme;
  welcome: FormWelcome;
  sections: RendererSection[];
  fields: RendererFieldFull[];
  /** Hanya dipakai di pratinjau; saat mengisi, server yang memilih ending. */
  endings?: RendererEnding[];
};

type Page =
  | { kind: 'welcome' }
  | {
      kind: 'questions';
      section: RendererSection | null;
      fields: RendererFieldFull[];
    }
  | { kind: 'review' };

const FONT_STACKS: Record<NonNullable<FormTheme['font']>, string> = {
  sans: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  serif: "Georgia, 'Times New Roman', serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const DEFAULT_ACCENT = '#2B6282';

/** Gambar dekoratif: hanya dari penyimpanan Anmategra, dan tanpa teks alternatif dianggap hiasan murni. */
function Decor({
  url,
  alt,
  className,
}: {
  url: string | null | undefined;
  alt?: string | null;
  className: string;
}) {
  if (!url || !isAllowedImageHost(url)) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? ''} className={className} />;
}

/** Halaman: sambutan (bila ada), satu per bagian yang berisi pertanyaan, lalu tinjauan (bila diminta). */
function buildPages(
  form: RendererForm,
  visibleFields: RendererFieldFull[],
): Page[] {
  const pages: Page[] = [];
  if (form.welcome.title ?? form.welcome.description)
    pages.push({ kind: 'welcome' });

  const known = new Set(form.sections.map((s) => s.id));
  const loose = visibleFields.filter(
    (f) => f.sectionId === null || !known.has(f.sectionId),
  );
  if (loose.length > 0)
    pages.push({ kind: 'questions', section: null, fields: loose });
  for (const section of form.sections) {
    const fields = visibleFields.filter((f) => f.sectionId === section.id);
    if (fields.length > 0) pages.push({ kind: 'questions', section, fields });
  }
  if (form.settings.reviewBeforeSubmit) pages.push({ kind: 'review' });
  return pages;
}

function formatAnswer(field: RendererFieldFull, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  const option = (id: string) =>
    field.options.find((o) => o.id === id)?.label ?? id;
  switch (field.type) {
    case 'single_choice':
      return typeof value === 'string' ? option(value) : '—';
    case 'multiple_choice':
      return Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string')
            .map(option)
            .join(', ')
        : '—';
    case 'unit_choice':
      return Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === 'string')
            .map((id, i) => `${i + 1}. ${option(id)}`)
            .join('; ')
        : '—';
    case 'checkbox':
      return value === true ? 'Ya' : 'Tidak';
    case 'matrix': {
      const rows = field.config.rows ?? [];
      const cols = field.config.columns ?? [];
      const label = (id: string) =>
        cols.find((col) => col.id === id)?.label ?? id;
      return rows
        .filter((r) => (value as Record<string, unknown>)[r.id] !== undefined)
        .map((r) => {
          const cell = (value as Record<string, string | string[]>)[r.id]!;
          return `${r.label}: ${Array.isArray(cell) ? cell.map(label).join(', ') : label(cell)}`;
        })
        .join('; ');
    }
    default:
      return typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '—';
  }
}

export type FillSubmitResult = SubmitResult & {
  ending?: { title: string; description: string | null } | null;
};

/** Hanya jawaban untuk pertanyaan yang masih ada yang dipulihkan dari draf. */
function readDraft(
  storageKey: string | undefined,
  fields: RendererFieldFull[],
): Record<string, unknown> {
  if (!storageKey) return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return {};
    const known = new Set(
      fields.filter((f) => f.type !== 'text_block').map((f) => f.id),
    );
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([id]) =>
        known.has(id),
      ),
    );
  } catch {
    return {};
  }
}

function writeDraft(storageKey: string, answers: Record<string, unknown>) {
  try {
    if (Object.keys(answers).length === 0)
      window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(answers));
  } catch {
    // Penyimpanan penuh atau diblokir: pengisian tetap jalan tanpa draf.
  }
}

/**
 * Tampilan pengisi satu form. Mode `preview` tidak mengirim ke mana pun. Mode
 * `fill` mengirim lewat `onSubmit`, menyimpan draf di perangkat (bila
 * `autosaveDraft` menyala dan ada `storageKey`) dan memperingatkan sebelum
 * halaman ditinggalkan (bila `confirmOnLeave` menyala).
 */
export function FormRenderer({
  form,
  mode,
  onSubmit,
  storageKey,
  initialAnswers,
}: {
  form: RendererForm;
  mode: 'preview' | 'fill' | 'edit';
  onSubmit?: (answers: Record<string, unknown>) => Promise<FillSubmitResult>;
  storageKey?: string;
  /** Jawaban yang sudah tersimpan, saat menyunting kiriman sebelumnya. */
  initialAnswers?: Record<string, unknown>;
}) {
  const filling = mode !== 'preview';
  const editing = mode === 'edit';
  // Draf hanya untuk pengisian baru: saat menyunting, sumber kebenarannya
  // jawaban server, bukan draf lama di perangkat.
  const draftKey =
    mode === 'fill' && form.settings.autosaveDraft ? storageKey : undefined;
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({
    ...initialAnswers,
    ...readDraft(draftKey, form.fields),
  }));
  // Pertanyaan dan bagian yang tampil menurut jawaban saat ini; yang
  // tersembunyi tidak ikut dihitung, divalidasi, atau dikirim.
  const visibility = computeVisibility(
    form.fields.map((f) => ({
      id: f.id,
      type: f.type,
      sectionId: f.sectionId,
      condition: f.condition ?? null,
    })),
    form.sections.map((s) => ({ id: s.id, condition: s.condition ?? null })),
    answers,
  );
  const visibleFields = form.fields.filter((f) => visibility.fields.has(f.id));
  const pages = buildPages(form, visibleFields);
  const [pageIndex, setPageIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [ending, setEnding] = useState<{
    title: string;
    description: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const dirty = Object.keys(answers).length > 0 && !done;

  // Pindah halaman: gulir ke atas form (M-13), kecuali pada render pertama.
  const rootRef = useRef<HTMLDivElement>(null);
  const shownPage = useRef(0);
  useEffect(() => {
    if (shownPage.current === pageIndex) return;
    shownPage.current = pageIndex;
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pageIndex]);

  useEffect(() => {
    if (draftKey && !done) writeDraft(draftKey, answers);
  }, [draftKey, answers, done]);

  useEffect(() => {
    if (!filling || !form.settings.confirmOnLeave || !dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [filling, form.settings.confirmOnLeave, dirty]);

  // Tema datang dari pembuat form dan dipakai di halaman orang lain: hanya
  // warna heks yang sah yang dipasang ke gaya.
  const color = (value: string | undefined, fallback: string) =>
    value && HEX_COLOR.test(value) ? value : fallback;
  const accent = color(form.theme.accent, DEFAULT_ACCENT);
  const style = {
    '--form-accent': accent,
    backgroundColor: color(form.theme.bg, '#FFFFFF'),
    fontFamily: FONT_STACKS[form.theme.font ?? 'sans'],
  } as React.CSSProperties;

  const answerable = visibleFields.filter((f) => f.type !== 'text_block');
  const numbers = new Map(answerable.map((f, i) => [f.id, i + 1]));
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const questionPages = pages.filter((p) => p.kind === 'questions');
  const lastIndex = pages.length - 1;

  const restart = () => {
    setAnswers({});
    setErrors({});
    setPageIndex(0);
    setDone(false);
    setEnding(null);
  };

  const scrollToField = (fieldId: string) =>
    document
      .getElementById(`field-q-${fieldId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const submit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    setFormError(null);
    try {
      // Jawaban pertanyaan yang tersembunyi tetap di memori tetapi tidak dikirim.
      const sent = Object.fromEntries(
        visibleFields.flatMap((f) =>
          f.id in answers ? [[f.id, answers[f.id]]] : [],
        ),
      );
      const result = await onSubmit(sent);
      const outcome = classifySubmitResult(
        result,
        form.fields.map((f) => f.id),
      );
      if (outcome.kind === 'field') {
        setErrors(outcome.fieldErrors);
        const target = pages.findIndex(
          (p) =>
            p.kind === 'questions' &&
            p.fields.some((f) => f.id === outcome.firstId),
        );
        if (target >= 0) setPageIndex(target);
        // Tunggu halaman tujuan tampil sebelum menggulir.
        setTimeout(() => scrollToField(outcome.firstId), 50);
        setFormError(
          target >= 0
            ? 'Ada jawaban yang perlu diperbaiki.'
            : 'Form ini berubah saat kamu mengisi. Muat ulang halaman, lalu periksa kembali jawabanmu.',
        );
        return;
      }
      if (outcome.kind === 'error') {
        setFormError(outcome.message);
        return;
      }
      if (draftKey) writeDraft(draftKey, {});
      setEnding(result.ending ?? null);
      setDone(true);
    } catch {
      setFormError('Jawabanmu belum terkirim. Periksa koneksi lalu coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (page?.kind === 'questions') {
      const problems = validatePage(page.fields, answers);
      setErrors(problems);
      if (Object.keys(problems).length > 0) {
        scrollToField(Object.keys(problems)[0]!);
        return;
      }
    }
    setErrors({});
    setFormError(null);
    if (pageIndex < lastIndex) {
      setPageIndex(pageIndex + 1);
    } else if (filling) {
      void submit();
    } else {
      toast('Ini pratinjau: jawaban tidak dikirim.');
      const chosenId = pickEnding(
        (form.endings ?? []).map((e) => ({
          id: e.id,
          sortOrder: e.sortOrder,
          condition: e.condition ?? null,
        })),
        visibility,
        answers,
        form.fields.map((f) => ({
          id: f.id,
          type: f.type,
          sectionId: f.sectionId,
          condition: f.condition ?? null,
        })),
      );
      setEnding(form.endings?.find((e) => e.id === chosenId) ?? null);
      setDone(true);
    }
  };

  const primary =
    'bg-[var(--form-accent)] text-white hover:opacity-90 focus-visible:ring-[var(--form-accent)]';

  if (pages.length === 0) {
    return (
      <div
        style={style}
        className="rounded-[24px] border border-neutral-400 p-8 text-center text-neutral-700"
      >
        Form ini belum punya pertanyaan.
      </div>
    );
  }

  if (done) {
    return (
      <div
        style={style}
        role="status"
        className="rounded-[24px] border border-neutral-400 p-8 text-center"
      >
        <h2 className="text-2xl font-semibold text-neutral-1000">
          {ending?.title ?? 'Terima kasih!'}
        </h2>
        <p className="mt-2 whitespace-pre-line text-neutral-700">
          {ending
            ? ending.description
            : editing
              ? 'Perubahan jawabanmu sudah tersimpan.'
              : filling
                ? 'Jawabanmu sudah terkirim.'
                : 'Ini hanya pratinjau, jadi jawaban tidak dikirim.'}
        </p>
        {ending && !filling ? (
          <p className="mt-2 text-sm text-neutral-700">
            Ini hanya pratinjau, jadi jawaban tidak dikirim.
          </p>
        ) : null}
        {filling || editing ? (
          <Link
            href="/"
            className={cn(
              'mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold',
              primary,
            )}
          >
            Kembali ke beranda
          </Link>
        ) : (
          <Button className={cn('mt-6', primary)} onClick={restart}>
            Ulangi pratinjau
          </Button>
        )}
      </div>
    );
  }

  const questionIndex =
    page?.kind === 'questions' ? questionPages.indexOf(page) : -1;

  return (
    <div
      ref={rootRef}
      style={style}
      className="scroll-mt-4 overflow-hidden rounded-[24px] border border-neutral-400 p-5 sm:p-8"
    >
      <Decor
        url={form.theme.banner}
        className="-mx-5 -mt-5 mb-6 h-40 w-[calc(100%+2.5rem)] max-w-none object-cover sm:-mx-8 sm:-mt-8 sm:w-[calc(100%+4rem)]"
      />
      {form.settings.showProgress &&
      questionPages.length > 1 &&
      page?.kind === 'questions' ? (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-neutral-700">
            <span>
              Bagian {questionIndex + 1} dari {questionPages.length}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={questionPages.length}
            aria-valuenow={questionIndex + 1}
            aria-label="Kemajuan pengisian"
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200"
          >
            <div
              className="h-full rounded-full bg-[var(--form-accent)]"
              style={{
                width: `${((questionIndex + 1) / questionPages.length) * 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {page?.kind === 'welcome' ? (
        <div>
          <h2 className="text-3xl font-semibold text-neutral-1000">
            {form.welcome.title ?? form.title}
          </h2>
          {form.welcome.description ? (
            <p className="mt-3 whitespace-pre-line text-neutral-700">
              {form.welcome.description}
            </p>
          ) : null}
        </div>
      ) : null}

      {page?.kind === 'questions' ? (
        <div className="grid gap-5">
          {pageIndex === 0 || page.section === null ? (
            <header>
              <Decor
                url={form.theme.logo}
                className="mb-3 h-14 w-auto max-w-[12rem] object-contain"
              />
              <h2 className="text-2xl font-semibold text-neutral-1000">
                {form.title}
              </h2>
              {form.description ? (
                <p className="mt-2 whitespace-pre-line text-neutral-700">
                  {form.description}
                </p>
              ) : null}
            </header>
          ) : null}
          {page.section ? (
            <div>
              <h3 className="text-xl font-semibold text-neutral-1000">
                {page.section.title}
              </h3>
              {page.section.description ? (
                <p className="mt-1 text-neutral-700">
                  {page.section.description}
                </p>
              ) : null}
            </div>
          ) : null}
          {page.fields.map((field) => {
            const error = errors[field.id];
            const number = numbers.get(field.id);
            if (field.type === 'text_block') {
              return (
                <div key={field.id} className="rounded-xl bg-neutral-100 p-4">
                  <p className="font-semibold text-neutral-1000">
                    <RichText value={field.label} />
                  </p>
                  {field.description ? (
                    <p className="mt-1 text-sm text-neutral-700">
                      <RichText value={field.description} />
                    </p>
                  ) : null}
                </div>
              );
            }
            return (
              <div
                key={field.id}
                id={`field-q-${field.id}`}
                className="grid gap-2"
              >
                <label
                  id={`label-${field.id}`}
                  htmlFor={`fill-${field.id}`}
                  className="font-semibold text-neutral-1000"
                >
                  {form.settings.showNumbers && number ? `${number}. ` : ''}
                  <RichText value={field.label} />
                  {field.required ? (
                    <>
                      <span aria-hidden className="ml-1 text-tomato">
                        *
                      </span>
                      <span className="sr-only"> (wajib diisi)</span>
                    </>
                  ) : null}
                </label>
                {field.description ? (
                  <p className="text-sm text-neutral-700">
                    <RichText value={field.description} />
                  </p>
                ) : null}
                <Decor
                  url={field.image?.url}
                  alt={field.image?.alt}
                  className="max-h-64 rounded-xl object-contain"
                />
                <AnswerInput
                  field={field}
                  value={answers[field.id]}
                  invalid={!!error}
                  describedBy={error ? `err-${field.id}` : undefined}
                  shuffleOptions={form.settings.shuffleOptions}
                  upload={{
                    enabled: filling,
                    formId: form.id,
                    folder: form.title,
                    closesAt: form.closesAt ?? null,
                  }}
                  onChange={(value) => {
                    setAnswers((prev) => ({ ...prev, [field.id]: value }));
                    if (error)
                      setErrors((prev) =>
                        Object.fromEntries(
                          Object.entries(prev).filter(([k]) => k !== field.id),
                        ),
                      );
                  }}
                />
                {/* Ruang pesan galat dipesan agar tata letak tidak bergeser saat pesan hilang (M-13). */}
                <p
                  id={`err-${field.id}`}
                  role={error ? 'alert' : undefined}
                  className="min-h-5 text-sm text-danger-dark"
                >
                  {error}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {page?.kind === 'review' ? (
        <div>
          <h2 className="text-2xl font-semibold text-neutral-1000">
            Tinjau jawabanmu
          </h2>
          <dl className="mt-4 grid gap-3">
            {answerable.map((field) => (
              <div key={field.id} className="rounded-xl bg-neutral-100 p-3">
                <dt className="text-sm text-neutral-700">
                  {richTextToPlain(field.label)}
                </dt>
                <dd className="mt-0.5 text-neutral-1000">
                  {formatAnswer(field, answers[field.id])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <p
        role={formError ? 'alert' : undefined}
        className="mt-6 min-h-5 text-sm text-danger-dark"
      >
        {formError}
      </p>

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Button
          variant="dark_blue_outline"
          disabled={pageIndex === 0 || submitting}
          onClick={() => {
            setErrors({});
            setPageIndex(Math.max(0, pageIndex - 1));
          }}
        >
          Kembali
        </Button>
        <Button className={primary} onClick={next} disabled={submitting}>
          {submitting
            ? editing
              ? 'Menyimpan…'
              : 'Mengirim…'
            : page?.kind === 'welcome'
              ? (form.welcome.buttonLabel ?? 'Mulai')
              : pageIndex >= lastIndex
                ? editing
                  ? 'Simpan perubahan'
                  : 'Kirim'
                : 'Lanjut'}
        </Button>
      </div>
    </div>
  );
}
