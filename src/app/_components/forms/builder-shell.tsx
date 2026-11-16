'use client';

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  Eye,
  Inbox,
  LayoutList,
  ListTree,
  Loader2,
  type LucideIcon,
  Palette,
  Plus,
  Redo2,
  Settings,
  Undo2,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';

import { AddMenu } from './add-menu';
import { BuilderProvider, useBuilder } from './builder-context';
import { CanvasDnd } from './canvas-dnd';
import { DeleteSectionDialog } from './delete-section-dialog';
import { DesignSheet } from './design-sheet';
import { EndingsPanel } from './endings-panel';
import { FlowPane } from './flow-pane';
import { StatusBadge } from './forms-list';
import { InsertSection } from './insert-section';
import type { ContentGroup, FormStatus, SectionOut } from './model';
import { PagesPanel } from './pages-panel';
import { PenilaianPane } from './penilaian/penilaian-pane';
import { PreviewPane } from './preview-pane';
import { SectionCard } from './section-card';
import { SettingsSheet } from './settings-sheet';
import { SharePopover } from './share-popover';
import { type SaveState, useFormBuilder } from './use-form-builder';

type Tab = 'konten' | 'alur' | 'penilaian' | 'pratinjau';

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'konten', label: 'Konten', Icon: LayoutList },
  { id: 'alur', label: 'Alur', Icon: Workflow },
  { id: 'penilaian', label: 'Penilaian', Icon: ClipboardCheck },
  { id: 'pratinjau', label: 'Pratinjau', Icon: Eye },
];

const SAVE_TEXT: Record<SaveState, string> = {
  idle: '',
  saving: 'Menyimpan…',
  saved: 'Tersimpan',
  error: 'Gagal menyimpan',
};

export function FormBuilder({
  formId,
  backHref,
  backLabel,
  responsesHref,
  ownerName,
}: {
  formId: string;
  backHref: string;
  backLabel: string;
  responsesHref: string;
  ownerName: string;
}) {
  const builder = useFormBuilder(formId);
  // Penilaian hanya untuk formulir yang terikat oprec.
  const tabItems = TABS.filter(
    (t) => t.id !== 'penilaian' || !!builder.detail?.oprec,
  );
  const [tab, setTab] = useState<Tab>('konten');
  const [deleting, setDeleting] = useState<SectionOut | null>(null);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const { detail } = builder;
  const headRef = useRef<HTMLDivElement>(null);
  const hasDetail = !!detail;

  // Tinggi kepala builder sebagai variabel CSS, dipakai panel samping yang
  // menempel tepat di bawahnya.
  useEffect(() => {
    const head = headRef.current;
    if (!head) return;
    const update = () =>
      document.documentElement.style.setProperty(
        '--builder-head-h',
        `${head.offsetHeight}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(head);
    return () => observer.disconnect();
  }, [hasDetail]);

  // Ctrl+Z / Ctrl+Shift+Z untuk operasi struktur; di dalam kolom teks biarkan
  // undo bawaan browser bekerja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        void builder.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        void builder.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [builder]);

  // Peringatan bila meninggalkan halaman saat masih ada yang belum tersimpan.
  useEffect(() => {
    if (!builder.hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [builder.hasUnsaved]);

  const { removeSection } = builder.shared;
  const requestDelete = useCallback(
    (group: ContentGroup) => {
      if (group.fields.length === 0) void removeSection(group.section);
      else setDeleting(group.section);
    },
    [removeSection, setDeleting],
  );

  if (builder.isLoading) {
    return (
      <div
        aria-busy="true"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-12"
      >
        <div className="h-8 w-1/3 animate-pulse rounded bg-neutral-200" />
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-neutral-200" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div
        role="alert"
        className="mx-4 mt-8 rounded-[24px] border border-neutral-400 p-6 sm:mx-auto sm:max-w-3xl"
      >
        <p className="font-semibold text-neutral-1000">
          Form tidak bisa dimuat.
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          {builder.error?.message}
        </p>
        <Button
          className="mt-4"
          variant="dark_blue_outline"
          onClick={() => void builder.refetch()}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  const sections = detail.sections;
  const noContent = sections.length === 0;

  const toolbar = (className: string) => (
    <div className={cn('flex flex-wrap items-center gap-2 py-3', className)}>
      <button
        type="button"
        onClick={() => setDesignOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-secondary-100 py-1 pl-1.5 pr-4 text-sm font-semibold text-secondary-800 ring-1 ring-inset ring-secondary-300 transition-colors duration-150 hover:bg-secondary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full border-2 border-neutral-50 shadow-sm"
          style={{
            backgroundColor: detail.theme.accent ?? '#2B6282',
          }}
        >
          <Palette className="size-3.5 text-white" />
        </span>
        Desain
      </button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 rounded-full px-3 text-sm"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings /> Pengaturan
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button asChild variant="dark_blue_outline">
          <Link href={responsesHref}>
            <Inbox /> Respons
            <span className="ml-0.5 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-400">
              {detail.submissionCount}
            </span>
          </Link>
        </Button>
        <SharePopover />
        <StatusActions status={detail.status} />
      </div>
    </div>
  );

  return (
    <BuilderProvider value={builder.shared}>
      <div className="pb-10">
        {/* Kepala builder selebar layar, menempel tepat di bawah navbar situs. */}
        <div
          ref={headRef}
          className="sticky top-[var(--app-navbar-h,0px)] z-[15] border-b border-neutral-400 bg-neutral-50 shadow-[0_6px_16px_-12px_rgba(15,34,45,0.35)]"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-12">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 pb-3 pt-3 sm:pb-0 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="min-w-0">
                <nav
                  aria-label="Breadcrumb"
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <Link
                    href={backHref}
                    className="inline-flex shrink-0 items-center gap-1 rounded text-sm text-neutral-700 transition-colors duration-150 hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <ChevronLeft aria-hidden className="size-4" />
                    {backLabel}
                  </Link>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-neutral-500"
                  />
                  <input
                    key={detail.title}
                    defaultValue={detail.title}
                    aria-label="Judul form"
                    title="Klik untuk mengganti judul"
                    maxLength={255}
                    className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-neutral-1000 transition-colors duration-150 hover:border-neutral-400 focus-visible:border-primary-400 focus-visible:outline-none"
                    onBlur={(e) => {
                      const value = e.currentTarget.value.trim();
                      if (value && value !== detail.title) {
                        void builder.saveForm({ title: value });
                      } else {
                        e.currentTarget.value = detail.title;
                      }
                    }}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && e.currentTarget.blur()
                    }
                  />
                </nav>
                <p className="flex flex-wrap items-center gap-x-2 pl-6 text-xs text-neutral-700">
                  <span className="truncate">{ownerName}</span>
                  <span aria-hidden>·</span>
                  <Link
                    href={responsesHref}
                    className="text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    {detail.submissionCount} respons
                  </Link>
                  <StatusBadge status={detail.status} />
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Bagian builder"
                className="col-span-2 row-start-2 flex justify-center gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1"
              >
                {tabItems.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    id={`tab-${id}`}
                    aria-selected={tab === id}
                    aria-controls={`panel-${id}`}
                    onClick={() => {
                      void builder.flushAll();
                      setTab(id);
                    }}
                    className={cn(
                      'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-secondary-400 px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 sm:flex-none',
                      tab === id
                        ? 'bg-secondary-400 text-white shadow-[0_4px_12px_-6px_rgba(0,146,146,0.7)]'
                        : 'bg-neutral-50 text-secondary-700 hover:bg-secondary-100',
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 lg:col-start-3">
                <span
                  aria-live="polite"
                  className={cn(
                    'mr-1 hidden items-center gap-1.5 text-sm sm:inline-flex',
                    builder.saveState === 'error'
                      ? 'text-danger-dark'
                      : 'text-neutral-700',
                  )}
                >
                  {builder.saveState === 'saving' ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : builder.saveState === 'saved' ? (
                    <CheckCircle2 aria-hidden className="size-4" />
                  ) : builder.saveState === 'error' ? (
                    <CloudOff aria-hidden className="size-4" />
                  ) : null}
                  {SAVE_TEXT[builder.saveState]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Urungkan"
                  title="Urungkan (Ctrl+Z)"
                  disabled={!builder.canUndo}
                  onClick={() => void builder.undo()}
                >
                  <Undo2 />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ulangi"
                  title="Ulangi (Ctrl+Shift+Z)"
                  disabled={!builder.canRedo}
                  onClick={() => void builder.redo()}
                >
                  <Redo2 />
                </Button>
              </div>
            </header>

            {toolbar('hidden sm:flex')}
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-12">
          {/* Di layar sempit bilah alat tidak ikut menempel, supaya kepala tetap ramping. */}
          {toolbar('-mt-3 mb-3 sm:hidden')}
          {builder.publishProblem?.fieldId === null ? (
            <p
              role="alert"
              className="mb-6 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
            >
              {builder.publishProblem.message}
              {builder.detail?.oprec && builder.detail.eventId ? (
                <>
                  {' '}
                  <Link
                    className="font-medium underline"
                    href={`${backHref.replace(/\/forms$/, '')}/oprec/${builder.detail.oprec.recruitmentId}`}
                  >
                    Buka halaman oprec
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          {tab === 'konten' ? (
            <div
              role="tabpanel"
              id="panel-konten"
              aria-labelledby="tab-konten"
              className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
            >
              <aside className="hidden min-w-0 lg:block">
                <div className="sticky top-[calc(var(--app-navbar-h,0px)+var(--builder-head-h,8rem)+1rem)] max-h-[calc(100vh-var(--app-navbar-h,0px)-var(--builder-head-h,8rem)-2rem)] overflow-y-auto overflow-x-hidden rounded-[24px] border border-neutral-400 bg-neutral-50 p-4">
                  <PagesPanel />
                </div>
              </aside>
              <div className="mx-auto grid w-full max-w-3xl gap-6">
                <div className="lg:hidden">
                  <Button
                    variant="dark_blue_outline"
                    onClick={() => setPagesOpen(true)}
                  >
                    <ListTree /> Halaman
                  </Button>
                </div>
                {noContent ? (
                  <div className="rounded-[24px] border border-neutral-400 p-8 text-center">
                    <p className="font-semibold text-neutral-1000">
                      Form ini belum berisi apa pun.
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      Tambahkan pertanyaan, atau bagi form menjadi beberapa
                      bagian.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <AddMenu
                        variant="light_blue"
                        label="Tambah pertanyaan"
                        onSelect={(kind) => {
                          const first = sections[0]?.id;
                          if (first) void builder.addField(kind, first);
                        }}
                      />
                      <Button
                        variant="dark_blue_outline"
                        onClick={() => void builder.addSection()}
                      >
                        <Plus /> Tambah bagian
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CanvasDnd>
                    {(groups) => (
                      <>
                        <InsertSection atIndex={0} />
                        {groups.map((group) => {
                          const position = sections.findIndex(
                            (s) => s.id === group.section.id,
                          );
                          return (
                            <Fragment key={group.section.id}>
                              <SectionCard
                                group={group}
                                position={position}
                                sectionCount={sections.length}
                                onDelete={requestDelete}
                              />
                              <InsertSection atIndex={position + 1} />
                            </Fragment>
                          );
                        })}
                        <div>
                          <Button
                            variant="dark_blue_outline"
                            onClick={() => void builder.addSection()}
                          >
                            <Plus /> Tambah bagian
                          </Button>
                        </div>
                        <EndingsPanel />
                      </>
                    )}
                  </CanvasDnd>
                )}
              </div>
            </div>
          ) : tab === 'alur' ? (
            <div role="tabpanel" id="panel-alur" aria-labelledby="tab-alur">
              <FlowPane
                onOpenInContent={(elementId) => {
                  setTab('konten');
                  setTimeout(
                    () =>
                      document.getElementById(elementId)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      }),
                    100,
                  );
                }}
              />
            </div>
          ) : tab === 'penilaian' && builder.detail?.oprec ? (
            <div
              role="tabpanel"
              id="panel-penilaian"
              aria-labelledby="tab-penilaian"
            >
              <PenilaianPane />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panel-pratinjau"
              aria-labelledby="tab-pratinjau"
            >
              <PreviewPane />
            </div>
          )}
        </div>
      </div>
      <DeleteSectionDialog
        section={deleting}
        onClose={() => setDeleting(null)}
      />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <DesignSheet open={designOpen} onOpenChange={setDesignOpen} />
      <Sheet open={pagesOpen} onOpenChange={setPagesOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Halaman</SheetTitle>
            <SheetDescription>
              Daftar bagian dan pertanyaan form.
            </SheetDescription>
          </SheetHeader>
          <PagesPanel onNavigate={() => setPagesOpen(false)} />
        </SheetContent>
      </Sheet>
    </BuilderProvider>
  );
}

function StatusActions({ status }: { status: FormStatus }) {
  const builder = useBuilder();
  const [confirmClose, setConfirmClose] = useState(false);
  return (
    <>
      {status === 'Draft' ? (
        <Button
          variant="light_blue"
          onClick={() => void builder.changeStatus('Published')}
        >
          Terbitkan
        </Button>
      ) : null}
      {status === 'Published' ? (
        <>
          <Button
            variant="dark_blue_outline"
            onClick={() => void builder.changeStatus('Draft')}
          >
            Kembali ke draf
          </Button>
          <Button
            variant="warning_outline"
            onClick={() => setConfirmClose(true)}
          >
            Tutup form
          </Button>
          <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
            <DialogContent className="rounded-[20px]">
              <DialogHeader>
                <DialogTitle>Tutup form?</DialogTitle>
                <DialogDescription>
                  Pendaftar tidak bisa lagi mengirim jawaban. Form bisa dibuka
                  kembali nanti.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="dark_blue_outline"
                  onClick={() => setConfirmClose(false)}
                >
                  Batal
                </Button>
                <Button
                  variant="warning"
                  onClick={() => {
                    setConfirmClose(false);
                    void builder.changeStatus('Closed');
                  }}
                >
                  Tutup form
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {status === 'Closed' ? (
        <>
          <Button
            variant="dark_blue_outline"
            onClick={() => void builder.changeStatus('Draft')}
          >
            Kembali ke draf
          </Button>
          <Button
            variant="light_blue"
            onClick={() => void builder.changeStatus('Published')}
          >
            Buka kembali
          </Button>
        </>
      ) : null}
    </>
  );
}
