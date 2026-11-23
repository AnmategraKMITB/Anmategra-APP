'use client';

// Simulasi pembuat form: kepala builder, tab Konten/Alur/Penilaian/Pratinjau,
// panel Halaman, kartu bagian, dan kartu pertanyaan — semuanya dengan state
// di memori saja.
// Library Import
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Copy,
  Eye,
  GripVertical,
  Hash,
  Inbox,
  Info,
  LayoutList,
  Link2,
  ListChecks,
  ListOrdered,
  ListTree,
  Palette,
  Paperclip,
  Plus,
  Redo2,
  Settings,
  Share2,
  SlidersHorizontal,
  SplitSquareVertical,
  Trash2,
  Type,
  Undo2,
  Workflow,
  X,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';

import { DEMO_DIVISIONS, DEMO_EVENT, DEMO_LEMBAGA } from '../data';
import { DemoFrame, type DemoGuide, type DemoStep } from '../demo-frame';
import { Btn, Modal, Pill, Toggle, inputClass, useFlash } from '../ui';
import {
  type AnswerValue,
  type Answers,
  type DemoField,
  type FieldKind,
  Question,
} from './form-shared';

const STEPS: DemoStep[] = [
  { id: 'judul', title: 'Ubah **judul form** di bagian atas' },
  {
    id: 'tambah',
    title:
      'Klik **Tambah konten** di bawah bagian, lalu pilih **Pilihan tunggal**',
  },
  {
    id: 'isi',
    title: 'Tulis pertanyaannya, lalu ubah teks salah satu pilihan',
    hint: 'Tekan tombol **Tambah pilihan** bila butuh lebih dari dua.',
  },
  { id: 'wajib', title: 'Nyalakan **Wajib diisi** pada pertanyaan itu' },
  {
    id: 'pratinjau',
    title:
      'Buka tab **Pratinjau** untuk melihat form seperti yang dilihat pengisi',
  },
];

const TABS = [
  ['konten', 'Konten', LayoutList],
  ['alur', 'Alur', Workflow],
  ['penilaian', 'Penilaian', ClipboardCheck],
  ['pratinjau', 'Pratinjau', Eye],
] as const;
type Tab = (typeof TABS)[number][0];

// ---------------------------------------------------------------------------
// Jenis pertanyaan yang dikenal simulasi ini
// ---------------------------------------------------------------------------

const KIND_META = [
  ['short_text', 'Teks pendek', 'Jawaban satu baris', Type],
  ['long_text', 'Teks panjang', 'Jawaban beberapa baris', AlignLeft],
  ['number', 'Angka', 'Hanya menerima angka', Hash],
  ['date', 'Tanggal', 'Pemilih tanggal', Calendar],
  ['single_choice', 'Pilihan tunggal', 'Satu jawaban dari daftar', CircleDot],
  ['dropdown', 'Dropdown', 'Daftar pilihan ringkas', ChevronDown],
  ['multiple_choice', 'Pilihan ganda', 'Boleh lebih dari satu', ListChecks],
  ['checkbox', 'Kotak centang', 'Satu centang persetujuan', CheckSquare],
  ['scale', 'Skala', 'Nilai bertingkat', SlidersHorizontal],
  ['link', 'Tautan', 'Alamat web', Link2],
  ['file', 'Unggah dokumen', 'Berkas dari pengisi', Paperclip],
  ['text_block', 'Blok teks', 'Penjelasan tanpa jawaban', Info],
  ['unit_choice', 'Pilihan tujuan', 'Pilih divisi oprec', ListOrdered],
] as const;

type KindMeta = (typeof KIND_META)[number];
type Kind = KindMeta[0];

type FormField = Omit<DemoField, 'kind'> & { kind: Kind; sectionId: string };
type DemoSection = { id: string; title: string; description: string };

const kindLabelOf = (kind: Kind) =>
  KIND_META.find(([id]) => id === kind)?.[1] ?? kind;

const hasOptions = (kind: Kind) =>
  kind === 'single_choice' || kind === 'dropdown' || kind === 'multiple_choice';

/** Question hanya mengenal jenis bawaan form-shared; 'file' dan
 *  'unit_choice' digambar sendiri oleh simulasi ini. */
const asShared = (field: FormField): DemoField => ({
  ...field,
  kind: field.kind as FieldKind,
});

function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  const meta = KIND_META.find(([id]) => id === kind);
  const Icon = meta ? meta[3] : Info;
  return <Icon aria-hidden className={className} />;
}

const INITIAL_SECTIONS: DemoSection[] = [
  {
    id: 's1',
    title: 'Kenalan dulu yukk!',
    description: 'Ceritain sedikit tentang kamu, ya!',
  },
  {
    id: 's2',
    title: 'Pilih divisi',
    description: 'Pilih divisi yang paling kamu mauu.',
  },
];

const INITIAL_FIELDS: FormField[] = [
  {
    id: 'f1',
    sectionId: 's1',
    kind: 'short_text',
    label: 'Ummm.. boleh tau gak nama panggilannya siapaa??',
    required: true,
    options: [],
  },
  {
    id: 'f2',
    sectionId: 's1',
    kind: 'date',
    label: 'Ulang tahun kamu kapan tuhh?',
    required: true,
    options: [],
  },
  {
    id: 'f3',
    sectionId: 's1',
    kind: 'short_text',
    label: 'MBTI kamu apaasichh??',
    required: false,
    options: [],
  },
  {
    id: 'f4',
    sectionId: 's1',
    kind: 'file',
    label: '📸 Infokan foto terbaikmu dong!',
    required: true,
    options: [],
  },
  {
    id: 'f5',
    sectionId: 's2',
    kind: 'unit_choice',
    label: 'Pilih divisi yang paling kamu mauu!',
    required: true,
    options: DEMO_DIVISIONS.map((division) => division.name),
  },
];

/** Mengukur lebar jendela demo: panel samping dilipat saat sempit. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export default function FormsBuilderDemo() {
  return (
    <DemoFrame
      title="Pembuat form"
      location={`Lembaga › Forms › Oprec ${DEMO_EVENT}`}
      steps={STEPS}
    >
      {(guide) => <Body guide={guide} />}
    </DemoFrame>
  );
}

function Body({ guide }: { guide: DemoGuide }) {
  const [tab, setTab] = useState<Tab>('konten');
  const [title, setTitle] = useState(`Pendaftaran Panitia ${DEMO_EVENT}`);
  const [status, setStatus] = useState<'Draf' | 'Terbit' | 'Ditutup'>('Draf');
  const [sections, setSections] = useState<DemoSection[]>(INITIAL_SECTIONS);
  const [fields, setFields] = useState<FormField[]>(INITIAL_FIELDS);
  const [counter, setCounter] = useState(6);
  const [sectionCounter, setSectionCounter] = useState(3);
  const [answers, setAnswers] = useState<Answers>({});
  const [pagesOpen, setPagesOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accent, setAccent] = useState('#2B6282');
  const [collectEmail, setCollectEmail] = useState(false);
  const { flash, node } = useFlash();
  const { ref, width } = useWidth();

  // Breakpoint diukur dari lebar jendela demo, bukan viewport halaman manual.
  const wide = width >= 760;

  const numbers = new Map<string, number>();
  let running = 0;
  for (const item of fields) {
    if (item.kind === 'text_block') continue;
    running += 1;
    numbers.set(item.id, running);
  }

  const patch = (id: string, next: Partial<FormField>) =>
    setFields((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...next } : item)),
    );

  // Langkah "isi" selesai begitu ada pilihan tunggal berjudul dengan opsi yang
  // sudah diganti dari teks bawaannya.
  const checkFilled = (field: FormField) => {
    if (
      field.kind === 'single_choice' &&
      field.label.trim() !== '' &&
      field.options.some((option) => !/^Pilihan \d+$/.test(option))
    ) {
      guide.complete('isi');
    }
  };

  const insertField = (kind: Kind, sectionId: string, afterId?: string) => {
    const id = `f${counter}`;
    setCounter((value) => value + 1);
    const item: FormField = {
      id,
      sectionId,
      kind,
      label: kind === 'text_block' ? 'Penjelasan' : '',
      required: false,
      options:
        kind === 'unit_choice'
          ? DEMO_DIVISIONS.map((division) => division.name)
          : hasOptions(kind)
            ? ['Pilihan 1', 'Pilihan 2']
            : [],
    };
    setFields((prev) => {
      const siblings = prev.filter((field) => field.sectionId === sectionId);
      const anchor = afterId
        ? prev.find((field) => field.id === afterId)
        : siblings[siblings.length - 1];
      if (!anchor) return [...prev, item];
      const at = prev.indexOf(anchor);
      return [...prev.slice(0, at + 1), item, ...prev.slice(at + 1)];
    });
    if (kind === 'single_choice') guide.complete('tambah');
  };

  const changeKind = (field: FormField, kind: Kind) =>
    patch(field.id, {
      kind,
      options:
        kind === 'unit_choice'
          ? DEMO_DIVISIONS.map((division) => division.name)
          : hasOptions(kind) && field.options.length === 0
            ? ['Pilihan 1', 'Pilihan 2']
            : field.options,
    });

  const moveField = (field: FormField, delta: number) =>
    setFields((prev) => {
      const siblings = prev.filter(
        (item) => item.sectionId === field.sectionId,
      );
      const at = siblings.indexOf(field);
      const target = siblings[at + delta];
      if (at < 0 || !target) return prev;
      const from = prev.indexOf(field);
      const to = prev.indexOf(target);
      const next = [...prev];
      next[from] = target;
      next[to] = field;
      return next;
    });

  /** Pindahkan pertanyaan ke posisi pertanyaan tujuan, boleh lintas bagian. */
  const dropField = (dragId: string, targetId: string) =>
    setFields((prev) => {
      if (dragId === targetId) return prev;
      const dragged = prev.find((item) => item.id === dragId);
      const target = prev.find((item) => item.id === targetId);
      if (!dragged || !target) return prev;
      const rest = prev.filter((item) => item.id !== dragId);
      const draggedAt = prev.indexOf(dragged);
      const targetAt = prev.indexOf(target);
      // Diseret ke bawah: taruh sesudah tujuan; ke atas: sebelum tujuan.
      const at = rest.indexOf(target) + (draggedAt < targetAt ? 1 : 0);
      return [
        ...rest.slice(0, at),
        { ...dragged, sectionId: target.sectionId },
        ...rest.slice(at),
      ];
    });

  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [dropFieldId, setDropFieldId] = useState<string | null>(null);

  const fieldDrop = (fieldId: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragFieldId || dragFieldId === fieldId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dropFieldId !== fieldId) setDropFieldId(fieldId);
    },
    onDragLeave: () => {
      if (dropFieldId === fieldId) setDropFieldId(null);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      if (dragFieldId) dropField(dragFieldId, fieldId);
      setDragFieldId(null);
      setDropFieldId(null);
    },
  });

  const fieldDrag = (fieldId: string) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', fieldId);
      setDragFieldId(fieldId);
    },
    onDragEnd: () => {
      setDragFieldId(null);
      setDropFieldId(null);
    },
  });

  const duplicateField = (field: FormField) => {
    const id = `f${counter}`;
    setCounter((value) => value + 1);
    setFields((prev) => {
      const at = prev.indexOf(field);
      const copy: FormField = { ...field, id, options: [...field.options] };
      return [...prev.slice(0, at + 1), copy, ...prev.slice(at + 1)];
    });
  };

  const removeField = (id: string) =>
    setFields((prev) => prev.filter((item) => item.id !== id));

  const splitSection = (field: FormField) => {
    const at = sections.findIndex((section) => section.id === field.sectionId);
    const current = sections[at];
    if (!current) return;
    const id = `s${sectionCounter}`;
    setSectionCounter((value) => value + 1);
    setSections((prev) => [
      ...prev.slice(0, at + 1),
      { id, title: `${current.title} (lanjutan)`, description: '' },
      ...prev.slice(at + 1),
    ]);
    const siblings = fields.filter((item) => item.sectionId === current.id);
    const moved = new Set(
      siblings.slice(siblings.indexOf(field)).map((item) => item.id),
    );
    setFields((prev) =>
      prev.map((item) =>
        moved.has(item.id) ? { ...item, sectionId: id } : item,
      ),
    );
  };

  const addSection = () => {
    const id = `s${sectionCounter}`;
    setSectionCounter((value) => value + 1);
    setSections((prev) => [
      ...prev,
      { id, title: `Bagian ${sectionCounter}`, description: '' },
    ]);
  };

  const moveSection = (position: number, delta: number) =>
    setSections((prev) => {
      const target = position + delta;
      const current = prev[position];
      const other = prev[target];
      if (!current || !other) return prev;
      const next = [...prev];
      next[position] = other;
      next[target] = current;
      return next;
    });

  const removeSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((section) => section.id !== id));
    setFields((prev) => prev.filter((item) => item.sectionId !== id));
  };

  const jumpTo = (fieldId: string) => {
    setPagesOpen(false);
    setTab('konten');
    document
      .getElementById(`demo-fb-${fieldId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const unitChoiceTaken = fields.some((item) => item.kind === 'unit_choice');
  const addKinds = KIND_META.filter(
    ([kind]) => kind !== 'unit_choice' || !unitChoiceTaken,
  );

  const pagesPanel = (onNavigate?: () => void) => (
    <PagesPanel
      dragProps={(id) => ({ ...fieldDrag(id), ...fieldDrop(id) })}
      sections={sections}
      fields={fields}
      numbers={numbers}
      onAddSection={() => {
        addSection();
        onNavigate?.();
      }}
      onJump={jumpTo}
    />
  );

  return (
    <div ref={ref} className="relative -m-4 h-[560px] bg-neutral-50">
      <div className="h-full overflow-y-auto">
        {/* Kepala builder, menempel di atas jendela demo. */}
        <div className="sticky top-0 z-10 border-b border-neutral-400 bg-neutral-50 shadow-[0_6px_16px_-12px_rgba(15,34,45,0.35)]">
          <div className="px-3 pt-3 sm:px-4">
            <header
              className={cn(
                'grid items-center gap-x-4 gap-y-2',
                wide
                  ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
                  : 'grid-cols-[minmax(0,1fr)_auto]',
              )}
            >
              <div className="min-w-0">
                <nav
                  aria-label="Breadcrumb"
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span className="inline-flex shrink-0 items-center gap-1 rounded text-sm text-neutral-700">
                    <ChevronLeft aria-hidden className="size-4" />
                    Forms
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-neutral-500"
                  />
                  <input
                    aria-label="Judul form"
                    title="Klik untuk mengganti judul"
                    maxLength={255}
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      if (event.target.value.trim() !== '') {
                        guide.complete('judul');
                      }
                    }}
                    className={cn(
                      'min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-neutral-1000 transition-colors duration-150 hover:border-neutral-400 focus-visible:border-primary-400 focus-visible:outline-none',
                      guide.spot('judul'),
                    )}
                  />
                </nav>
                <p className="flex flex-wrap items-center gap-x-2 pl-6 text-xs text-neutral-700">
                  <span className="truncate">{DEMO_LEMBAGA}</span>
                  <span aria-hidden>·</span>
                  <span className="text-primary-400 underline-offset-2">
                    0 respons
                  </span>
                  <Pill
                    tone={
                      status === 'Draf'
                        ? 'warning'
                        : status === 'Terbit'
                          ? 'success'
                          : 'danger'
                    }
                  >
                    {status}
                  </Pill>
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Bagian builder"
                className={cn(
                  'flex justify-center gap-2',
                  wide ? '' : 'order-last col-span-2',
                )}
              >
                {TABS.map(([id, label, Icon]) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    id={`tab-${id}`}
                    aria-selected={tab === id}
                    onClick={() => {
                      setTab(id);
                      if (id === 'pratinjau') guide.complete('pratinjau');
                    }}
                    className={cn(
                      'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-secondary-400 px-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
                      wide && 'h-10 flex-none gap-2 px-4',
                      tab === id
                        ? 'bg-secondary-400 text-white shadow-[0_4px_12px_-6px_rgba(0,146,146,0.7)]'
                        : 'bg-neutral-50 text-secondary-700 hover:bg-secondary-100',
                      id === 'pratinjau' && guide.spot('pratinjau'),
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div
                className={cn(
                  'flex items-center justify-end gap-1',
                  wide ? '' : 'col-start-2 row-start-1',
                )}
              >
                <span
                  aria-live="polite"
                  className="mr-1 inline-flex items-center gap-1.5 text-sm text-neutral-700"
                >
                  <CheckCircle2 aria-hidden className="size-4" />
                  Tersimpan
                </span>
                <Btn tone="ghost" small aria-label="Urungkan" disabled>
                  <Undo2 aria-hidden />
                </Btn>
                <Btn tone="ghost" small aria-label="Ulangi" disabled>
                  <Redo2 aria-hidden />
                </Btn>
              </div>
            </header>

            {/* Bilah alat: desain, pengaturan, respons, bagikan, status. */}
            <div className="flex flex-wrap items-center gap-2 py-3">
              <button
                type="button"
                onClick={() => setDesignOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-secondary-100 py-1 pl-1.5 pr-4 text-sm font-semibold text-secondary-800 ring-1 ring-inset ring-secondary-300 transition-colors duration-150 hover:bg-secondary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <span
                  aria-hidden
                  className="flex size-6 items-center justify-center rounded-full border-2 border-neutral-50 shadow-sm"
                  style={{ backgroundColor: accent }}
                >
                  <Palette className="size-3.5 text-white" />
                </span>
                Desain
              </button>
              <Btn
                tone="ghost"
                small
                className="h-9 rounded-full px-3 text-sm"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings aria-hidden /> Pengaturan
              </Btn>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Btn
                  tone="outline"
                  onClick={() => flash('Buka tab Respons di aplikasi asli.')}
                >
                  <Inbox aria-hidden /> Respons
                  <span className="ml-0.5 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-400">
                    0
                  </span>
                </Btn>
                <Btn
                  tone="outline"
                  onClick={() => flash('Tautan form disalin (simulasi).')}
                >
                  <Share2 aria-hidden /> Bagikan
                </Btn>
                {status === 'Draf' ? (
                  <Btn tone="primary" onClick={() => setStatus('Terbit')}>
                    Terbitkan
                  </Btn>
                ) : null}
                {status === 'Terbit' ? (
                  <>
                    <Btn tone="outline" onClick={() => setStatus('Draf')}>
                      Kembali ke draf
                    </Btn>
                    <Btn
                      tone="dangerOutline"
                      onClick={() => setStatus('Ditutup')}
                    >
                      Tutup form
                    </Btn>
                  </>
                ) : null}
                {status === 'Ditutup' ? (
                  <>
                    <Btn tone="outline" onClick={() => setStatus('Draf')}>
                      Kembali ke draf
                    </Btn>
                    <Btn tone="primary" onClick={() => setStatus('Terbit')}>
                      Buka kembali
                    </Btn>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Tab Konten                                                       */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'konten' ? (
          <div
            role="tabpanel"
            id="panel-konten"
            aria-labelledby="tab-konten"
            className={cn(
              'grid gap-4 p-3 sm:p-4',
              wide ? 'grid-cols-[17rem_minmax(0,1fr)]' : '',
            )}
          >
            {wide ? (
              <aside className="min-w-0">
                <div className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-3">
                  {pagesPanel()}
                </div>
              </aside>
            ) : null}

            <div className="mx-auto grid w-full max-w-3xl content-start gap-4">
              {!wide ? (
                <Btn
                  tone="outline"
                  className="justify-self-start"
                  onClick={() => setPagesOpen(true)}
                >
                  <ListTree aria-hidden /> Halaman
                </Btn>
              ) : null}

              {sections.map((section, position) => {
                const sectionFields = fields.filter(
                  (field) => field.sectionId === section.id,
                );
                return (
                  <section
                    key={section.id}
                    aria-label={section.title}
                    className="rounded-[24px] border border-neutral-400 bg-neutral-100 p-3 sm:p-5"
                  >
                    <div className="mb-4 flex flex-wrap items-start gap-3">
                      <div className="grid min-w-0 flex-1 gap-2">
                        <input
                          aria-label="Judul bagian"
                          maxLength={255}
                          value={section.title}
                          onChange={(event) =>
                            setSections((prev) =>
                              prev.map((item) =>
                                item.id === section.id
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className={cn(inputClass, 'text-lg font-semibold')}
                        />
                        <input
                          aria-label="Deskripsi bagian"
                          placeholder="Deskripsi bagian (opsional)"
                          value={section.description}
                          onChange={(event) =>
                            setSections((prev) =>
                              prev.map((item) =>
                                item.id === section.id
                                  ? {
                                      ...item,
                                      description: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Btn
                          tone="ghost"
                          small
                          aria-label="Naikkan bagian"
                          disabled={position === 0}
                          onClick={() => moveSection(position, -1)}
                        >
                          <ArrowUp aria-hidden />
                        </Btn>
                        <Btn
                          tone="ghost"
                          small
                          aria-label="Turunkan bagian"
                          disabled={position === sections.length - 1}
                          onClick={() => moveSection(position, 1)}
                        >
                          <ArrowDown aria-hidden />
                        </Btn>
                        <Btn
                          tone="ghost"
                          small
                          aria-label="Hapus bagian"
                          className="text-danger-dark hover:text-danger-dark"
                          disabled={sections.length <= 1}
                          onClick={() => removeSection(section.id)}
                        >
                          <Trash2 aria-hidden />
                        </Btn>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {sectionFields.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-neutral-400 px-4 py-6 text-center text-sm text-neutral-700">
                          Bagian ini belum berisi pertanyaan.
                        </p>
                      ) : null}

                      {sectionFields.map((field) => {
                        const number = numbers.get(field.id);
                        const first = sectionFields[0]?.id === field.id;
                        const last =
                          sectionFields[sectionFields.length - 1]?.id ===
                          field.id;
                        return (
                          <article
                            key={field.id}
                            id={`demo-fb-${field.id}`}
                            aria-label={`Pertanyaan ${number ?? ''}`}
                            {...fieldDrop(field.id)}
                            className={cn(
                              'rounded-[24px] border border-neutral-400 bg-neutral-50 p-4 transition-colors',
                              field.id === dropFieldId &&
                                'border-secondary-400 ring-2 ring-secondary-400',
                              field.id === dragFieldId && 'opacity-50',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                {...fieldDrag(field.id)}
                                aria-label="Seret untuk memindahkan pertanyaan"
                                title="Seret untuk memindahkan"
                                className="-ml-1 grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-neutral-500 hover:bg-neutral-200 active:cursor-grabbing"
                              >
                                <GripVertical className="size-4" aria-hidden />
                              </span>
                              <span
                                aria-hidden
                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-400 text-sm font-semibold text-white"
                              >
                                {number}
                              </span>
                              <select
                                aria-label="Jenis pertanyaan"
                                value={field.kind}
                                onChange={(event) =>
                                  changeKind(field, event.target.value as Kind)
                                }
                                className="h-8 rounded-md border border-neutral-400 bg-neutral-50 px-2 text-sm text-neutral-700 hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                {KIND_META.map(([kind, label]) => (
                                  <option key={kind} value={kind}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="mt-4 grid gap-3">
                              <div className="grid gap-1.5">
                                <label
                                  htmlFor={`label-${field.id}`}
                                  className="text-sm font-semibold text-neutral-1000"
                                >
                                  Pertanyaan
                                </label>
                                <input
                                  id={`label-${field.id}`}
                                  maxLength={500}
                                  placeholder="Pertanyaan tanpa judul"
                                  value={field.label}
                                  onChange={(event) => {
                                    patch(field.id, {
                                      label: event.target.value,
                                    });
                                    checkFilled({
                                      ...field,
                                      label: event.target.value,
                                    });
                                  }}
                                  className={cn(inputClass, guide.spot('isi'))}
                                />
                              </div>

                              {hasOptions(field.kind) ? (
                                <fieldset className="grid gap-2">
                                  <legend className="text-sm font-semibold text-neutral-1000">
                                    Pilihan
                                  </legend>
                                  <ul className="grid gap-1.5">
                                    {field.options.map((option, index) => (
                                      <li
                                        key={`${field.id}-${index}`}
                                        className="flex items-center gap-1.5"
                                      >
                                        <span
                                          aria-hidden
                                          className={cn(
                                            'size-4 shrink-0 border border-neutral-500',
                                            field.kind === 'multiple_choice'
                                              ? 'rounded'
                                              : 'rounded-full',
                                          )}
                                        />
                                        <input
                                          aria-label={`Pilihan ${index + 1}`}
                                          maxLength={255}
                                          value={option}
                                          onChange={(event) => {
                                            const options = field.options.map(
                                              (item, i) =>
                                                i === index
                                                  ? event.target.value
                                                  : item,
                                            );
                                            patch(field.id, { options });
                                            checkFilled({ ...field, options });
                                          }}
                                          className={cn(inputClass, 'h-8')}
                                        />
                                        <Btn
                                          tone="ghost"
                                          small
                                          aria-label={`Naikkan pilihan ${index + 1}`}
                                          disabled={index === 0}
                                          onClick={() => {
                                            const options = [...field.options];
                                            const prevOption =
                                              options[index - 1];
                                            const current = options[index];
                                            if (
                                              !prevOption ||
                                              current === undefined
                                            ) {
                                              return;
                                            }
                                            options[index - 1] = current;
                                            options[index] = prevOption;
                                            patch(field.id, { options });
                                          }}
                                        >
                                          <ArrowUp aria-hidden />
                                        </Btn>
                                        <Btn
                                          tone="ghost"
                                          small
                                          aria-label={`Turunkan pilihan ${index + 1}`}
                                          disabled={
                                            index === field.options.length - 1
                                          }
                                          onClick={() => {
                                            const options = [...field.options];
                                            const nextOption =
                                              options[index + 1];
                                            const current = options[index];
                                            if (
                                              !nextOption ||
                                              current === undefined
                                            ) {
                                              return;
                                            }
                                            options[index + 1] = current;
                                            options[index] = nextOption;
                                            patch(field.id, { options });
                                          }}
                                        >
                                          <ArrowDown aria-hidden />
                                        </Btn>
                                        <Btn
                                          tone="ghost"
                                          small
                                          aria-label={`Hapus pilihan ${index + 1}`}
                                          disabled={field.options.length <= 1}
                                          onClick={() =>
                                            patch(field.id, {
                                              options: field.options.filter(
                                                (_, i) => i !== index,
                                              ),
                                            })
                                          }
                                        >
                                          <X aria-hidden />
                                        </Btn>
                                      </li>
                                    ))}
                                  </ul>
                                  <div>
                                    <Btn
                                      tone="outline"
                                      small
                                      onClick={() =>
                                        patch(field.id, {
                                          options: [
                                            ...field.options,
                                            `Pilihan ${field.options.length + 1}`,
                                          ],
                                        })
                                      }
                                    >
                                      <Plus aria-hidden /> Tambah pilihan
                                    </Btn>
                                  </div>
                                </fieldset>
                              ) : null}

                              {field.kind === 'unit_choice' ? (
                                <p className="rounded-xl bg-neutral-200 px-4 py-3 text-sm text-neutral-700">
                                  Pendaftar memilih 2 tujuan, berurutan, dari
                                  divisi yang dibuka oprec. Daftar tujuan dan
                                  jumlah pilihan diatur di pengaturan oprec.
                                </p>
                              ) : null}

                              {field.kind === 'file' ? (
                                <p className="text-sm text-neutral-700">
                                  Berkas disimpan di UploadThing. Tautan berkas
                                  bersifat publik: siapa pun yang memiliki
                                  tautan dapat membukanya.
                                </p>
                              ) : null}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-400 pt-3">
                              <AddMenu
                                kinds={addKinds}
                                label="Tambah pertanyaan..."
                                tone="ghost"
                                small
                                onPick={(kind) =>
                                  insertField(kind, field.sectionId, field.id)
                                }
                              />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                              <Toggle
                                label="Wajib diisi"
                                checked={field.required}
                                onChange={(required) => {
                                  patch(field.id, { required });
                                  if (
                                    required &&
                                    field.kind === 'single_choice'
                                  ) {
                                    guide.complete('wajib');
                                  }
                                }}
                                className={cn(
                                  'text-sm font-medium',
                                  guide.spot('wajib'),
                                )}
                              />
                              <div className="ml-auto flex flex-wrap items-center gap-1">
                                <select
                                  aria-label="Pindahkan ke bagian"
                                  value={field.sectionId}
                                  onChange={(event) =>
                                    patch(field.id, {
                                      sectionId: event.target.value,
                                    })
                                  }
                                  className="h-9 w-32 rounded-md border border-neutral-400 bg-white px-2 text-sm text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                                >
                                  {sections.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.title}
                                    </option>
                                  ))}
                                </select>
                                <Btn
                                  tone="ghost"
                                  small
                                  aria-label="Naikkan"
                                  disabled={first}
                                  onClick={() => moveField(field, -1)}
                                >
                                  <ArrowUp aria-hidden />
                                </Btn>
                                <Btn
                                  tone="ghost"
                                  small
                                  aria-label="Turunkan"
                                  disabled={last}
                                  onClick={() => moveField(field, 1)}
                                >
                                  <ArrowDown aria-hidden />
                                </Btn>
                                <Btn
                                  tone="ghost"
                                  small
                                  aria-label="Mulai bagian baru dari pertanyaan ini"
                                  title="Mulai bagian baru dari pertanyaan ini"
                                  onClick={() => splitSection(field)}
                                >
                                  <SplitSquareVertical aria-hidden />
                                </Btn>
                                <Btn
                                  tone="ghost"
                                  small
                                  aria-label="Duplikat"
                                  onClick={() => duplicateField(field)}
                                >
                                  <Copy aria-hidden />
                                </Btn>
                                <Btn
                                  tone="ghost"
                                  small
                                  aria-label="Hapus"
                                  className="text-danger-dark hover:text-danger-dark"
                                  onClick={() => removeField(field.id)}
                                >
                                  <Trash2 aria-hidden />
                                </Btn>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <AddMenu
                        kinds={addKinds}
                        label="Tambah konten"
                        spotClass={
                          position === 0 ? guide.spot('tambah') : undefined
                        }
                        onPick={(kind) => insertField(kind, section.id)}
                      />
                    </div>
                  </section>
                );
              })}

              <div>
                <Btn tone="outline" onClick={addSection}>
                  <Plus aria-hidden /> Tambah bagian
                </Btn>
              </div>

              <div className="rounded-[24px] border border-dashed border-neutral-400 bg-neutral-50 p-5">
                <p className="text-sm font-semibold text-neutral-1000">
                  Pesan akhir
                </p>
                <p className="mt-1 text-sm text-neutral-700">
                  Setelah mengirim jawaban, pendaftar melihat: “Terima kasih
                  sudah mendaftar! Sampai jumpa di {DEMO_EVENT} 🎉”
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Tab Alur                                                         */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'alur' ? (
          <div
            role="tabpanel"
            id="panel-alur"
            aria-labelledby="tab-alur"
            className="mx-auto w-full max-w-3xl p-3 sm:p-4"
          >
            <p className="text-sm text-neutral-700">
              Urutan pertanyaan pada form ini. Klik kotak untuk membuka
              pertanyaannya di tab Konten.
            </p>
            <ol className="mt-3 flex flex-col items-center gap-1">
              {fields.map((field, index) => (
                <li
                  key={field.id}
                  className="flex w-full flex-col items-center gap-1"
                >
                  {index > 0 ? (
                    <ArrowDown
                      aria-hidden
                      className="size-4 text-neutral-500"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => jumpTo(field.id)}
                    className="w-full rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2 text-left transition-colors duration-150 hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <span className="flex items-center gap-2">
                      <KindIcon
                        kind={field.kind}
                        className="size-4 shrink-0 text-neutral-700"
                      />
                      <span className="truncate text-sm font-semibold text-neutral-1000">
                        {field.label || 'Pertanyaan tanpa judul'}
                      </span>
                      {field.required ? (
                        <span className="ml-auto shrink-0 text-xs font-semibold text-danger-dark">
                          wajib
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-700">
                      {kindLabelOf(field.kind)} · Selalu tampil (tanpa kondisi)
                    </span>
                  </button>
                </li>
              ))}
              <li className="flex w-full flex-col items-center gap-1">
                <ArrowDown aria-hidden className="size-4 text-neutral-500" />
                <div className="w-full rounded-xl border border-dashed border-neutral-500 bg-neutral-50 px-3 py-2">
                  <p className="text-sm font-semibold text-neutral-1000">
                    Ending
                  </p>
                  <p className="text-xs text-neutral-700">Terima kasih!</p>
                </div>
              </li>
            </ol>
          </div>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Tab Penilaian                                                    */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'penilaian' ? (
          <div
            role="tabpanel"
            id="panel-penilaian"
            aria-labelledby="tab-penilaian"
            className="mx-auto w-full max-w-3xl p-3 sm:p-4"
          >
            <div className="rounded-[24px] border border-neutral-400 bg-neutral-50 p-6 text-center">
              <p className="font-semibold text-neutral-1000">
                Penilaian diatur dari halaman oprec.
              </p>
              <p className="mt-1 text-sm text-neutral-700">
                Juri memberi skor tiap pendaftar di sana. Simulasi ini hanya
                memuat bagian konten form.
              </p>
            </div>
          </div>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {/* Tab Pratinjau                                                    */}
        {/* ---------------------------------------------------------------- */}
        {tab === 'pratinjau' ? (
          <div
            role="tabpanel"
            id="panel-pratinjau"
            aria-labelledby="tab-pratinjau"
            className="mx-auto grid w-full max-w-3xl gap-3 p-3 sm:p-4"
          >
            <p className="rounded-xl bg-neutral-200 px-4 py-2 text-xs text-neutral-700">
              Ini pratinjau: jawaban tidak dikirim ke mana pun.
            </p>
            <div className="rounded-[24px] border border-neutral-400 bg-white p-5">
              <p className="text-xl font-semibold text-neutral-1000">
                {title || 'Form tanpa judul'}
              </p>
              <p className="mt-1 text-sm text-neutral-700">
                {DEMO_LEMBAGA} · {DEMO_EVENT}
              </p>
              <div className="mt-5 grid gap-6">
                {sections.map((section) => (
                  <div key={section.id} className="grid gap-3">
                    <div>
                      <p className="text-base font-semibold text-neutral-1000">
                        {section.title}
                      </p>
                      {section.description ? (
                        <p className="text-sm text-neutral-700">
                          {section.description}
                        </p>
                      ) : null}
                    </div>
                    {fields
                      .filter((field) => field.sectionId === section.id)
                      .map((field) => (
                        <PreviewField
                          key={field.id}
                          field={field}
                          number={numbers.get(field.id)}
                          value={answers[field.id]}
                          onChange={(value) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [field.id]: value,
                            }))
                          }
                        />
                      ))}
                  </div>
                ))}
              </div>
              <Btn
                className="mt-5"
                onClick={() => flash('Jawaban tidak dikirim: ini pratinjau.')}
              >
                Kirim
              </Btn>
            </div>
          </div>
        ) : null}
      </div>

      {node}

      {pagesOpen ? (
        <Modal
          title="Halaman"
          description="Daftar bagian dan pertanyaan form."
          onClose={() => setPagesOpen(false)}
          footer={
            <Btn tone="outline" onClick={() => setPagesOpen(false)}>
              Tutup
            </Btn>
          }
        >
          {pagesPanel()}
        </Modal>
      ) : null}

      {designOpen ? (
        <Modal
          title="Desain form"
          description="Warna aksen dipakai pada tombol dan sorotan form."
          onClose={() => setDesignOpen(false)}
          footer={<Btn onClick={() => setDesignOpen(false)}>Selesai</Btn>}
        >
          <div
            role="radiogroup"
            aria-label="Warna aksen"
            className="flex flex-wrap gap-2"
          >
            {['#2B6282', '#009292', '#B45309', '#6D28D9', '#0F766E'].map(
              (color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={accent === color}
                  aria-label={`Warna ${color}`}
                  onClick={() => setAccent(color)}
                  style={{ backgroundColor: color }}
                  className={cn(
                    'size-9 rounded-full border-2 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    accent === color
                      ? 'border-neutral-1000'
                      : 'border-transparent',
                  )}
                />
              ),
            )}
          </div>
        </Modal>
      ) : null}

      {settingsOpen ? (
        <Modal
          title="Pengaturan form"
          description="Berlaku untuk seluruh form ini."
          onClose={() => setSettingsOpen(false)}
          footer={<Btn onClick={() => setSettingsOpen(false)}>Simpan</Btn>}
        >
          <div className="grid gap-1">
            <label
              htmlFor="demo-fb-settings-title"
              className="text-xs font-semibold text-neutral-800"
            >
              Judul form
            </label>
            <input
              id="demo-fb-settings-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </div>
          <Toggle
            label="Kumpulkan alamat email pengisi"
            checked={collectEmail}
            onChange={setCollectEmail}
            className="text-sm"
          />
        </Modal>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel "Halaman": daftar bagian dan pertanyaan
// ---------------------------------------------------------------------------

function PagesPanel({
  sections,
  fields,
  numbers,
  onAddSection,
  onJump,
  dragProps,
}: {
  dragProps: (fieldId: string) => React.HTMLAttributes<HTMLElement>;
  sections: DemoSection[];
  fields: FormField[];
  numbers: Map<string, number>;
  onAddSection: () => void;
  onJump: (fieldId: string) => void;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  const toggle = (id: string) =>
    setClosed((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  return (
    <nav aria-label="Halaman form" className="grid gap-3">
      <p className="text-lg font-semibold text-neutral-1000">Halaman</p>
      <div className="grid gap-2">
        {sections.map((section) => {
          const items = fields.filter(
            (field) => field.sectionId === section.id,
          );
          const open = !closed.includes(section.id);
          return (
            <div
              key={section.id}
              className="rounded-xl border border-neutral-400 p-2"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? 'Ciutkan' : 'Buka'} ${section.title}`}
                onClick={() => toggle(section.id)}
                className="flex w-full items-center gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {open ? (
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-neutral-700"
                  />
                ) : (
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-neutral-700"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-1000">
                  {section.title}
                </span>
                <span className="ml-auto text-xs tabular-nums text-neutral-700">
                  {items.length}
                </span>
              </button>
              {open ? (
                <ul className="mt-1 grid gap-0.5">
                  {items.length === 0 ? (
                    <li className="px-2 py-1.5 text-sm text-neutral-700">
                      Kosong.
                    </li>
                  ) : (
                    items.map((field) => (
                      <li
                        key={field.id}
                        {...dragProps(field.id)}
                        className="flex min-w-0 cursor-grab items-center gap-1 rounded-lg bg-neutral-50 active:cursor-grabbing"
                      >
                        <GripVertical
                          aria-hidden
                          className="ml-1 size-4 shrink-0 text-neutral-500"
                        />
                        <button
                          type="button"
                          onClick={() => onJump(field.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-neutral-1000 transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                        >
                          <span className="w-5 shrink-0 text-right text-xs font-semibold text-neutral-700">
                            {numbers.get(field.id) ?? ''}
                          </span>
                          <KindIcon
                            kind={field.kind}
                            className="size-4 shrink-0 text-neutral-700"
                          />
                          <span className="truncate">
                            {field.label || 'Tanpa judul'}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <Btn tone="primary" className="w-full" onClick={onAddSection}>
        <Plus aria-hidden /> Tambah bagian
      </Btn>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Menu jenis pertanyaan (pengganti popover)
// ---------------------------------------------------------------------------

function AddMenu({
  kinds,
  label,
  tone = 'outline',
  small = false,
  spotClass,
  onPick,
}: {
  kinds: readonly KindMeta[];
  label: string;
  tone?: 'outline' | 'ghost';
  small?: boolean;
  spotClass?: string;
  onPick: (kind: Kind) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Btn
        tone={tone}
        small={small}
        aria-expanded={open}
        aria-haspopup="menu"
        className={spotClass}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus aria-hidden /> {label}
      </Btn>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Tutup menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="menu"
            aria-label={label}
            className="absolute left-0 top-full z-20 mt-2 max-h-72 w-[min(22rem,80vw)] overflow-y-auto rounded-[20px] border border-neutral-400 bg-white p-2 shadow-lg"
          >
            {kinds.map(([kind, text, hint, Icon]) => (
              <li key={kind}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onPick(kind);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-400">
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-neutral-1000">
                      {text}
                    </span>
                    <span className="block text-xs text-neutral-700">
                      {hint}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Isian pratinjau: jenis bawaan memakai Question, dua jenis khas oprec
// digambar sendiri.
// ---------------------------------------------------------------------------

function PreviewField({
  field,
  number,
  value,
  onChange,
}: {
  field: FormField;
  number: number | undefined;
  value: AnswerValue;
  onChange: (next: AnswerValue) => void;
}) {
  if (field.kind === 'file') {
    const id = `demo-fb-file-${field.id}`;
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="block font-semibold text-neutral-1000">
          {number ? `${number}. ` : ''}
          {field.label}
          {field.required ? <span className="text-danger-dark"> *</span> : null}
        </label>
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-500 bg-neutral-50 px-4 py-6 text-sm text-neutral-700 transition-colors duration-150 hover:border-primary-400"
        >
          <Paperclip aria-hidden className="size-4" />
          Pilih berkas (PDF atau JPG, maks 5 MB)
        </label>
        <input
          id={id}
          type="file"
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0]?.name)}
        />
        {typeof value === 'string' && value !== '' ? (
          <p className="text-sm text-neutral-700">Terpilih: {value}</p>
        ) : null}
      </div>
    );
  }

  if (field.kind === 'unit_choice') {
    return (
      <div className="space-y-1.5">
        <p
          id={`demo-fb-unit-${field.id}`}
          className="font-semibold text-neutral-1000"
        >
          {number ? `${number}. ` : ''}
          {field.label}
          <span className="text-danger-dark"> *</span>
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`demo-fb-unit-${field.id}`}
          className="grid gap-1.5"
        >
          {field.options.map((option) => {
            const chosen = value === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => onChange(option)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  chosen
                    ? 'border-primary-400 bg-primary-100 font-semibold text-primary-600'
                    : 'border-neutral-400 bg-neutral-50 text-neutral-1000 hover:border-primary-400',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    chosen
                      ? 'border-primary-400 bg-primary-400 text-white'
                      : 'border-neutral-500 text-neutral-700',
                  )}
                >
                  {chosen ? '1' : '–'}
                </span>
                {option}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-neutral-700">
          Pilih satu divisi. Jumlah dan urutan pilihan diatur di pengaturan
          oprec.
        </p>
      </div>
    );
  }

  return (
    <Question
      field={asShared(field)}
      number={number}
      value={value}
      onChange={onChange}
    />
  );
}
