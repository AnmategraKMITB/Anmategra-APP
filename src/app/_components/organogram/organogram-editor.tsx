'use client';

import { PanelLeft, PanelRight, Redo2, Undo2 } from 'lucide-react';
import type { Session } from 'next-auth';
import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { SidebarAccount } from '~/app/_components/layout/sidebar';
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
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';

import { ChartView } from './chart-view';
import { Inspector } from './inspector';
import { SettingsView } from './settings-view';
import { StructurePanel } from './structure-panel';
import { TableView } from './table-view';
import { useOrganogramEditor } from './use-organogram-editor';

type Mode = 'bagan' | 'tabel' | 'pengaturan';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bagan', label: 'Bagan' },
  { id: 'tabel', label: 'Tabel' },
  { id: 'pengaturan', label: 'Pengaturan' },
];

export type OrganogramWorkspaceProps = {
  periodId: string;
  session: Session | null;
  lembagaName: string;
  kegiatanName: string;
  kegiatanHref: string;
  /** Pengelola lembaga pemilik periode ini; hanya mereka yang boleh membuat organogram. */
  canCreate: boolean;
};

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const newId = (): string => crypto.randomUUID();

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

function Skeleton(): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1" aria-busy="true">
      <div className="hidden w-[296px] shrink-0 space-y-3 border-r border-neutral-400 bg-white p-4 lg:block">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="h-8 animate-pulse rounded-[8px] bg-neutral-200"
          />
        ))}
      </div>
      <div className="flex-1 bg-neutral-100 p-8">
        <div className="mx-auto h-40 w-64 animate-pulse rounded-[12px] bg-neutral-200" />
      </div>
      <div className="hidden w-[304px] shrink-0 border-l border-neutral-400 bg-white lg:block" />
    </div>
  );
}

export function OrganogramWorkspace(
  props: OrganogramWorkspaceProps,
): JSX.Element {
  const { periodId, session, lembagaName, kegiatanName, kegiatanHref } = props;
  const ed = useOrganogramEditor(periodId);
  const {
    draft,
    dispatch,
    placements,
    persistedPositionIds,
    access,
    dirty,
    canUndo,
    canRedo,
  } = ed;

  const [mode, setMode] = useState<Mode>('bagan');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keepConflict, setKeepConflict] = useState(false);

  const isWide = useMediaQuery('(min-width: 1024px)');
  const isMedium = useMediaQuery('(min-width: 768px)');

  const readOnly = !isMedium || !(access?.canEdit ?? false);
  const editableUnitIds = access?.editableUnitIds ?? null;
  const canEditUnit = useCallback(
    (unitId: string) =>
      editableUnitIds === null || editableUnitIds.includes(unitId),
    [editableUnitIds],
  );
  const canEditRoot = editableUnitIds === null;

  // Ctrl/Cmd+Z dan Shift+Ctrl/Cmd+Z, kecuali saat mengetik di isian.
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'z'
      ) {
        return;
      }
      if (isTextTarget(event.target)) return;
      event.preventDefault();
      dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, dispatch]);

  const handleSave = async () => {
    setSaveError(null);
    const result = await ed.save();
    if (result.ok) {
      toast.success('Perubahan tersimpan.');
      return;
    }
    if (result.kind === 'conflict') {
      setKeepConflict(false);
      return;
    }
    setSaveError(result.message);
    toast.error(result.message);
  };

  const handleCreate = async () => {
    setCreateError(null);
    try {
      await ed.create();
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message !== ''
          ? error.message
          : 'Gagal membuat organogram. Coba lagi.',
      );
    }
  };

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id !== null && !isWide) setDetailOpen(true);
  };

  const profileSlot = <SidebarAccount session={session} />;

  const structurePanel = (
    <StructurePanel
      draft={draft}
      placements={placements}
      selectedId={selectedId}
      onSelect={select}
      dispatch={dispatch}
      canEditUnit={canEditUnit}
      canEditRoot={canEditRoot}
      readOnly={readOnly}
      newId={newId}
      profileSlot={profileSlot}
    />
  );

  const inspector = (
    <Inspector
      draft={draft}
      placements={placements}
      selectedId={selectedId}
      onSelect={setSelectedId}
      dispatch={dispatch}
      readOnly={readOnly}
      canEditUnit={canEditUnit}
      canEditRoot={canEditRoot}
      persistedPositionIds={persistedPositionIds}
      newId={newId}
      onAddPerson={ed.addPerson}
      onRemovePerson={ed.removePerson}
    />
  );

  const breadcrumb = (
    <nav aria-label="Jejak halaman" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-neutral-700">
        <li className="hidden shrink-0 sm:block">
          <Link href="/lembaga" className="underline hover:text-primary-400">
            Beranda
          </Link>
        </li>
        <li className="hidden max-w-[10rem] truncate md:block">
          <span aria-hidden className="mr-1.5">
            /
          </span>
          {lembagaName}
        </li>
        <li className="max-w-[12rem] truncate">
          <span aria-hidden className="mr-1.5 hidden sm:inline">
            /
          </span>
          <Link
            href={kegiatanHref}
            className="underline hover:text-primary-400"
          >
            {kegiatanName}
          </Link>
        </li>
        <li
          aria-current="page"
          className="shrink-0 font-semibold text-neutral-1000"
        >
          <span aria-hidden className="mr-1.5">
            /
          </span>
          Organogram
        </li>
      </ol>
    </nav>
  );

  const shell = (children: JSX.Element) => (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[480px] flex-col bg-neutral-100 sm:h-[calc(100dvh-4.5rem)]">
      {children}
    </div>
  );

  if (ed.isLoading) {
    return shell(
      <>
        <div className="flex h-12 shrink-0 items-center border-b border-neutral-400 bg-white px-4">
          {breadcrumb}
        </div>
        <Skeleton />
      </>,
    );
  }

  if (ed.error) {
    return shell(
      <>
        <div className="flex h-12 shrink-0 items-center border-b border-neutral-400 bg-white px-4">
          {breadcrumb}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-danger-dark" role="alert">
            {ed.error.message !== ''
              ? ed.error.message
              : 'Organogram tidak bisa dimuat.'}
          </p>
          <Button variant="dark_blue_outline" onClick={() => void ed.reload()}>
            Coba lagi
          </Button>
        </div>
      </>,
    );
  }

  if (ed.data === null) {
    return shell(
      <>
        <div className="flex h-12 shrink-0 items-center border-b border-neutral-400 bg-white px-4">
          {breadcrumb}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-1000">
            Belum ada organogram untuk periode ini
          </h1>
          {props.canCreate ? (
            <>
              <p className="max-w-md text-sm text-neutral-700">
                Buat kerangka kosong, lalu susun bagian dan jabatannya.
              </p>
              <Button
                variant="light_blue"
                onClick={() => void handleCreate()}
                disabled={ed.creating}
              >
                {ed.creating ? 'Membuat' : 'Buat organogram'}
              </Button>
              {createError ? (
                <p className="text-sm text-danger-dark" role="alert">
                  {createError}
                </p>
              ) : null}
            </>
          ) : (
            <p className="max-w-md text-sm text-neutral-700">
              Pengelola lembaga belum menyusunnya.
            </p>
          )}
        </div>
      </>,
    );
  }

  const modeButtons = (
    <div role="group" aria-label="Tampilan" className="flex items-center gap-1">
      {MODES.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(item.id)}
            className={cn(
              'h-8 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
              active
                ? 'border-secondary-800 bg-secondary-800 text-white'
                : 'border-secondary-400 bg-white text-secondary-800 hover:bg-secondary-100',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const banner = (() => {
    if (!isMedium) {
      return 'Di layar kecil organogram hanya bisa dilihat. Buka di laptop untuk mengubahnya.';
    }
    if (ed.editLocked && !(access?.canManage ?? false)) {
      return 'Organogram sedang dikunci. Anda hanya dapat melihatnya.';
    }
    if (!(access?.canEdit ?? false)) {
      return 'Anda hanya dapat melihat organogram ini.';
    }
    return null;
  })();

  return shell(
    <>
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-400 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {!isWide ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buka panel Struktur"
              onClick={() => setStructureOpen(true)}
            >
              <PanelLeft className="size-4" />
            </Button>
          ) : null}
          {breadcrumb}
          {ed.editLocked ? (
            <span className="shrink-0 rounded-full bg-warning-light px-2 py-0.5 text-xs font-semibold text-neutral-1000">
              Terkunci
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!readOnly ? (
            <>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Urungkan"
                  disabled={!canUndo}
                  onClick={() => dispatch({ type: 'undo' })}
                >
                  <Undo2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ulangi"
                  disabled={!canRedo}
                  onClick={() => dispatch({ type: 'redo' })}
                >
                  <Redo2 className="size-4" />
                </Button>
              </div>
              <span
                aria-live="polite"
                className={cn(
                  'text-sm',
                  dirty
                    ? 'font-semibold text-neutral-1000'
                    : 'text-neutral-700',
                )}
              >
                {dirty
                  ? 'Ada perubahan belum disimpan'
                  : 'Semua perubahan tersimpan'}
              </span>
              {dirty ? (
                <Button
                  variant="dark_blue_outline"
                  size="sm"
                  disabled={ed.saving}
                  onClick={() => dispatch({ type: 'revert' })}
                >
                  Batal
                </Button>
              ) : null}
              <Button
                variant="light_blue"
                size="sm"
                disabled={!dirty || ed.saving}
                onClick={() => void handleSave()}
              >
                {ed.saving ? 'Menyimpan' : 'Simpan'}
              </Button>
            </>
          ) : null}
          {modeButtons}
          {!isWide ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buka panel Detail"
              onClick={() => setDetailOpen(true)}
            >
              <PanelRight className="size-4" />
            </Button>
          ) : null}
        </div>
      </header>

      {banner !== null ? (
        <p className="shrink-0 border-b border-neutral-400 bg-primary-100 px-4 py-2 text-sm text-primary-400">
          {banner}
        </p>
      ) : null}
      {ed.stale ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-400 bg-warning-light px-4 py-2 text-sm text-neutral-1000">
          <span>
            Orang lain sudah menyimpan versi yang lebih baru. Memuat ulang akan
            membuang perubahan Anda yang belum disimpan.
          </span>
          <Button
            variant="dark_blue_outline"
            size="sm"
            onClick={() => void ed.reload()}
          >
            Muat ulang
          </Button>
        </div>
      ) : null}
      {saveError !== null ? (
        <p
          role="alert"
          className="shrink-0 border-b border-neutral-400 bg-danger-light px-4 py-2 text-sm text-danger-dark"
        >
          {saveError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {isWide ? (
          <aside
            aria-label="Struktur"
            className="w-[296px] shrink-0 border-r border-neutral-400 bg-white"
          >
            {structurePanel}
          </aside>
        ) : null}
        <main className="min-w-0 flex-1">
          {mode === 'bagan' ? (
            <ChartView
              draft={draft}
              placements={placements}
              selectedId={selectedId}
              onSelect={select}
            />
          ) : null}
          {mode === 'tabel' ? (
            <TableView
              draft={draft}
              placements={placements}
              selectedId={selectedId}
              onSelect={select}
            />
          ) : null}
          {mode === 'pengaturan' ? (
            <SettingsView
              draft={draft}
              dispatch={dispatch}
              canManage={(access?.canManage ?? false) && !readOnly}
              editLocked={ed.editLocked}
              canLock={access?.canLock ?? false}
              onSetLocked={ed.setLocked}
            />
          ) : null}
        </main>
        {isWide ? (
          <aside
            aria-label="Detail"
            className="w-[304px] shrink-0 border-l border-neutral-400 bg-white"
          >
            {inspector}
          </aside>
        ) : null}
      </div>

      {!isWide ? (
        <>
          <Sheet open={structureOpen} onOpenChange={setStructureOpen}>
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetTitle className="sr-only">Struktur</SheetTitle>
              <SheetDescription className="sr-only">
                Pohon bagian organogram
              </SheetDescription>
              {structurePanel}
            </SheetContent>
          </Sheet>
          <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
            <SheetContent side="right" className="w-[340px] p-0">
              <SheetTitle className="sr-only">Detail</SheetTitle>
              <SheetDescription className="sr-only">
                Detail bagian yang dipilih
              </SheetDescription>
              {inspector}
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <Dialog
        open={ed.conflict && !keepConflict}
        onOpenChange={(open) => {
          if (!open) setKeepConflict(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organogram sudah diubah orang lain</DialogTitle>
            <DialogDescription>
              Versi di server lebih baru daripada yang Anda buka. Memuat ulang
              membuang perubahan Anda yang belum disimpan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="dark_blue_outline"
              onClick={() => setKeepConflict(true)}
            >
              Tetap di sini
            </Button>
            <Button variant="warning" onClick={() => void ed.reload()}>
              Muat ulang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
  );
}
