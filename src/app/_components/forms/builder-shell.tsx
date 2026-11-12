'use client';

import { ListTree, Palette, Plus, Redo2, Settings, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
import { DeleteSectionDialog } from './delete-section-dialog';
import { DesignSheet } from './design-sheet';
import { EndingsPanel } from './endings-panel';
import { FlowPane } from './flow-pane';
import { StatusBadge } from './forms-list';
import type { FormStatus, SectionOut } from './model';
import { PagesPanel } from './pages-panel';
import { PenilaianPane } from './penilaian/penilaian-pane';
import { PreviewPane } from './preview-pane';
import { SectionCard } from './section-card';
import { SettingsSheet } from './settings-sheet';
import { SharePopover } from './share-popover';
import { type SaveState, useFormBuilder } from './use-form-builder';

type Tab = 'konten' | 'alur' | 'penilaian' | 'pratinjau';

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
  const tabItems: [Tab, string][] = [
    ['konten', 'Konten'],
    ['alur', 'Alur'],
    // Penilaian hanya untuk formulir yang terikat oprec.
    ...(builder.detail?.oprec
      ? [['penilaian', 'Penilaian'] as [Tab, string]]
      : []),
    ['pratinjau', 'Pratinjau'],
  ];
  const [tab, setTab] = useState<Tab>('konten');
  const [deleting, setDeleting] = useState<SectionOut | null>(null);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const { detail } = builder;

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

  if (builder.isLoading) {
    return (
      <div aria-busy="true" className="py-8">
        <div className="h-8 w-1/3 animate-pulse rounded bg-neutral-200" />
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-neutral-200" />
      </div>
    );
  }
  if (!detail) {
    return (
      <div
        role="alert"
        className="mt-8 rounded-[24px] border border-neutral-400 p-6"
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

  return (
    <BuilderProvider value={builder}>
      <div className="py-6 sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={backHref}
              className="text-sm text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              ← {backLabel}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {/* Textarea agar judul panjang membungkus, tidak terpotong (L-08). */}
              <textarea
                key={detail.title}
                rows={1}
                defaultValue={detail.title}
                aria-label="Judul form"
                maxLength={255}
                style={{ fieldSizing: 'content' } as React.CSSProperties}
                className="min-w-0 flex-1 resize-none break-words rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold text-neutral-1000 hover:border-neutral-400 focus-visible:border-primary-400 focus-visible:outline-none sm:text-[32px]"
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim();
                  if (value && value !== detail.title) {
                    void builder.saveForm({ title: value });
                  } else {
                    e.currentTarget.value = detail.title;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              <StatusBadge status={detail.status} />
            </div>
            <p className="mt-1 px-2 text-sm text-neutral-700">
              {ownerName} ·{' '}
              <Link
                href={responsesHref}
                className="text-primary-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                {detail.submissionCount} respons
              </Link>
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <span
              aria-live="polite"
              className={cn(
                'mr-auto text-sm sm:mr-0 sm:min-w-24',
                builder.saveState === 'error'
                  ? 'text-danger-dark'
                  : 'text-neutral-700',
              )}
            >
              {SAVE_TEXT[builder.saveState]}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Urungkan"
              disabled={!builder.canUndo}
              onClick={() => void builder.undo()}
            >
              <Undo2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ulangi"
              disabled={!builder.canRedo}
              onClick={() => void builder.redo()}
            >
              <Redo2 />
            </Button>
            <SharePopover />
            <Button
              variant="dark_blue_outline"
              aria-label="Pengaturan"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings /> <span className="hidden sm:inline">Pengaturan</span>
            </Button>
            <Button
              variant="dark_blue_outline"
              aria-label="Desain"
              onClick={() => setDesignOpen(true)}
            >
              <Palette /> <span className="hidden sm:inline">Desain</span>
            </Button>
            <StatusActions status={detail.status} />
          </div>
        </header>

        {builder.publishProblem?.fieldId === null ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-light px-4 py-3 text-sm text-danger-dark"
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

        <div
          role="tablist"
          aria-label="Bagian builder"
          className="mt-6 flex gap-1 border-b border-neutral-400"
        >
          {tabItems.map(([id, label]) => (
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
                '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                tab === id
                  ? 'border-primary-400 text-primary-400'
                  : 'border-transparent text-neutral-700 hover:text-neutral-1000',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'konten' ? (
          <div
            role="tabpanel"
            id="panel-konten"
            aria-labelledby="tab-konten"
            className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"
          >
            <aside className="hidden min-w-0 lg:block">
              <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden rounded-[24px] border border-neutral-400 bg-neutral-50 p-4">
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
                <>
                  {builder.groups.map((group) => (
                    <SectionCard
                      key={group.section.id}
                      group={group}
                      position={sections.findIndex(
                        (s) => s.id === group.section.id,
                      )}
                      sectionCount={sections.length}
                      onDelete={() => {
                        const section = group.section;
                        if (!section) return;
                        if (group.fields.length === 0)
                          void builder.removeSection(section);
                        else setDeleting(section);
                      }}
                    />
                  ))}
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
            </div>
          </div>
        ) : tab === 'alur' ? (
          <div
            role="tabpanel"
            id="panel-alur"
            aria-labelledby="tab-alur"
            className="mt-6"
          >
            <FlowPane
              onOpenInContent={(fieldId) => {
                setTab('konten');
                setTimeout(
                  () =>
                    document
                      .getElementById(`field-${fieldId}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
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
            className="mt-6"
          >
            <PenilaianPane />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="panel-pratinjau"
            aria-labelledby="tab-pratinjau"
            className="mt-6"
          >
            <PreviewPane />
          </div>
        )}
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
