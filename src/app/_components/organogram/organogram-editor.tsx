'use client';

import { Download, PanelLeft, PanelRight, Redo2, Undo2, X } from 'lucide-react';
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
import { ExportDialog } from './export-dialog';
import { ImportButton, ImportEntry } from './import-sheet';
import { Inspector } from './inspector';
import {
  descendantsOf,
  describeUndoable,
  endIndexOfPositions,
  planUnitsDrop,
} from './model';
import type { EditorAction, UnitDropPosition } from './model';
import { ResizeHandle, usePanel } from './panel-resize';
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

const HINT_KEY = 'organogram.hint.dismissed';

const LEFT_PANEL = {
  storageKey: 'organogram.panel.left',
  defaultWidth: 296,
  min: 220,
  max: 520,
};
const RIGHT_PANEL = {
  storageKey: 'organogram.panel.right',
  defaultWidth: 304,
  min: 260,
  max: 560,
};

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
  // Pilihan bisa kosong, satu bagian, atau banyak bagian; id yang sudah terhapus disaring.
  const [selectedIdsRaw, setSelectedIds] = useState<string[]>([]);
  const [structureOpen, setStructureOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [keepConflict, setKeepConflict] = useState(false);

  const isWide = useMediaQuery('(min-width: 1024px)');
  const leftPanel = usePanel(LEFT_PANEL);
  const rightPanel = usePanel(RIGHT_PANEL);
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

  // Ctrl/Cmd+\ menutup atau membuka kedua panel samping (seperti Figma).
  const { collapsed: leftCollapsed, setCollapsed: setLeftCollapsed } =
    leftPanel;
  const { collapsed: rightCollapsed, setCollapsed: setRightCollapsed } =
    rightPanel;
  useEffect(() => {
    if (!isWide) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== '\\') return;
      if (isTextTarget(event.target)) return;
      event.preventDefault();
      const hide = !(leftCollapsed && rightCollapsed);
      setLeftCollapsed(hide);
      setRightCollapsed(hide);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isWide,
    leftCollapsed,
    rightCollapsed,
    setLeftCollapsed,
    setRightCollapsed,
  ]);

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

  // Aksi yang merusak atau memindahkan banyak hal memunculkan toast "Urungkan".
  const dispatchAction = (action: EditorAction) => {
    const message = describeUndoable(action, draft);
    dispatch(action);
    if (message !== null) {
      toast(message, {
        duration: 7000,
        action: {
          label: 'Urungkan',
          onClick: () => dispatch({ type: 'undo' }),
        },
      });
    }
  };

  // Tombol aksi cepat pada node terpilih di bagan.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteUnit =
    pendingDeleteId === null
      ? null
      : (draft.units.find((unit) => unit.id === pendingDeleteId) ?? null);
  const handleChartAddChild = (parentId: string) => {
    const id = newId();
    dispatch({ type: 'addUnit', id, parentId });
    select(id);
  };
  const handleConfirmChartDelete = () => {
    if (pendingDeleteUnit === null) return;
    dispatchAction({ type: 'deleteUnit', id: pendingDeleteUnit.id });
    select(pendingDeleteUnit.parentId);
    setPendingDeleteId(null);
  };

  // Petunjuk di atas bagan; bisa ditutup dan diingat per peramban.
  const [hintOpen, setHintOpen] = useState(() => {
    try {
      return window.localStorage.getItem(HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const closeHint = () => {
    setHintOpen(false);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      // Penyimpanan tidak tersedia: petunjuk muncul lagi lain kali.
    }
  };

  // Seretan di bagan: bagian ke bagian lain, atau jabatan dari panel Detail ke sebuah bagian.
  const handleChartMoveUnit = (
    activeId: string,
    targetId: string,
    position: UnitDropPosition,
  ) => {
    // Menyeret salah satu bagian yang terpilih memindahkan seluruh pilihan.
    const ids =
      selectedIds.length > 1 && selectedIds.includes(activeId)
        ? selectedIds
        : [activeId];
    const plan = planUnitsDrop(draft.units, ids, targetId, position);
    if (!plan.ok) {
      toast.error(plan.reason);
      return;
    }
    const allowed =
      plan.parentId === null ? canEditRoot : canEditUnit(plan.parentId);
    if (!allowed || !plan.ids.every((id) => canEditUnit(id))) {
      toast.error('Anda tidak punya izin memindahkan bagian ke sana.');
      return;
    }
    dispatchAction({
      type: 'moveUnits',
      ids: plan.ids,
      parentId: plan.parentId,
      index: plan.index,
    });
  };

  const handleDropPositionOnUnit = (positionId: string, unitId: string) => {
    const moved = draft.positions.find((item) => item.id === positionId);
    if (!moved || moved.unitId === unitId) return;
    if (!canEditUnit(moved.unitId) || !canEditUnit(unitId)) {
      toast.error('Anda tidak punya izin memindahkan jabatan ini.');
      return;
    }
    dispatch({
      type: 'movePosition',
      id: positionId,
      unitId,
      index: endIndexOfPositions(draft.positions, unitId, positionId),
    });
  };

  const selectedIds = selectedIdsRaw.filter((id) =>
    draft.units.some((unit) => unit.id === id),
  );
  const selectedId = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null;

  const select = (id: string | null) => {
    setSelectedIds(id === null ? [] : [id]);
    if (id !== null && !isWide) setDetailOpen(true);
  };

  const selectMany = (ids: string[]) => {
    setSelectedIds(ids);
    if (ids.length > 0 && !isWide) setDetailOpen(true);
  };

  // Esc mengosongkan pilihan (kecuali saat mengetik atau ada dialog terbuka).
  const hasSelection = selectedIds.length > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (isTextTarget(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      setSelectedIds([]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSelection]);

  const profileSlot = <SidebarAccount session={session} />;

  const structurePanel = (
    <StructurePanel
      draft={draft}
      placements={placements}
      selectedId={selectedId}
      selectedIds={selectedIds}
      onSelect={select}
      onSelectIds={selectMany}
      dispatch={dispatchAction}
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
      selectedIds={selectedIds}
      onSelect={select}
      onSelectIds={selectMany}
      dispatch={dispatchAction}
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
              <ImportEntry
                periodId={props.periodId}
                onImported={() => ed.reload()}
              />
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
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              isWide
                ? leftPanel.collapsed
                  ? 'Buka panel Struktur'
                  : 'Tutup panel Struktur'
                : 'Buka panel Struktur'
            }
            aria-pressed={isWide ? !leftPanel.collapsed : undefined}
            onClick={() =>
              isWide ? leftPanel.toggle() : setStructureOpen(true)
            }
          >
            <PanelLeft className="size-4" />
          </Button>
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
              {/* Lebar tetap: teks status dan tombol Batal tidak boleh mengubah tinggi toolbar (M-12). */}
              <span
                aria-live="polite"
                className={cn(
                  'inline-block min-w-[15rem] text-right text-sm',
                  dirty
                    ? 'font-semibold text-neutral-1000'
                    : 'text-neutral-700',
                )}
              >
                {dirty
                  ? 'Ada perubahan belum disimpan'
                  : 'Semua perubahan tersimpan'}
              </span>
              <Button
                variant="dark_blue_outline"
                size="sm"
                disabled={!dirty || ed.saving}
                className={dirty ? undefined : 'invisible'}
                aria-hidden={dirty ? undefined : true}
                tabIndex={dirty ? undefined : -1}
                onClick={() => dispatch({ type: 'revert' })}
              >
                Batal
              </Button>
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
          {readOnly ? null : (
            <ImportButton
              periodId={props.periodId}
              onImported={() => ed.reload()}
            />
          )}
          <Button
            variant="dark_blue_outline"
            size="sm"
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" />
            Ekspor
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              isWide
                ? rightPanel.collapsed
                  ? 'Buka panel Detail'
                  : 'Tutup panel Detail'
                : 'Buka panel Detail'
            }
            aria-pressed={isWide ? !rightPanel.collapsed : undefined}
            onClick={() => (isWide ? rightPanel.toggle() : setDetailOpen(true))}
          >
            <PanelRight className="size-4" />
          </Button>
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
        {isWide && !leftPanel.collapsed ? (
          <aside
            aria-label="Struktur"
            style={{ width: leftPanel.width }}
            className="relative shrink-0 border-r border-neutral-400 bg-white"
          >
            {structurePanel}
            <ResizeHandle
              edge="right"
              label="Ubah lebar panel Struktur"
              width={leftPanel.width}
              min={LEFT_PANEL.min}
              max={LEFT_PANEL.max}
              onResize={leftPanel.setWidth}
              onCollapse={() => leftPanel.setCollapsed(true)}
              onReset={leftPanel.reset}
            />
          </aside>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">
          {mode === 'bagan' && hintOpen ? (
            <div
              role="note"
              className="flex shrink-0 items-start gap-2 border-b border-neutral-400 bg-primary-100 px-3 py-1.5 text-sm text-primary-400"
            >
              <p className="min-w-0 flex-1">
                {readOnly ? null : (
                  <>
                    Gunakan <strong>seret</strong> untuk memindahkan bagian atau
                    jabatan.{' '}
                  </>
                )}
                Ctrl atau Cmd + klik memilih beberapa, Shift + seret ruang
                kosong memilih dengan kotak. Cubit atau geser dua jari untuk
                zoom dan menggeser.
              </p>
              <button
                type="button"
                onClick={closeHint}
                aria-label="Tutup petunjuk"
                className="grid size-6 shrink-0 place-items-center rounded-[8px] hover:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}
          <div className="relative min-h-0 flex-1">
            {mode === 'bagan' ? (
              <ChartView
                draft={draft}
                placements={placements}
                selectedId={selectedId}
                selectedIds={selectedIds}
                onSelect={select}
                onSelectIds={selectMany}
                canEditUnit={canEditUnit}
                onMoveUnit={readOnly ? undefined : handleChartMoveUnit}
                onDropPositionOnUnit={
                  readOnly ? undefined : handleDropPositionOnUnit
                }
                onAddChild={readOnly ? undefined : handleChartAddChild}
                onRequestDelete={readOnly ? undefined : setPendingDeleteId}
                onResizeUnit={
                  readOnly
                    ? undefined
                    : (id, width) =>
                        dispatch({
                          type: 'setUnitLayout',
                          id,
                          patch: { width },
                        })
                }
                onArrange={
                  readOnly
                    ? undefined
                    : (arrangeMode) =>
                        dispatch({
                          type: 'arrangeUnits',
                          mode: arrangeMode,
                        })
                }
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
          </div>
        </main>
        {isWide && !rightPanel.collapsed ? (
          <aside
            aria-label="Detail"
            style={{ width: rightPanel.width }}
            className="relative shrink-0 border-l border-neutral-400 bg-white"
          >
            {inspector}
            <ResizeHandle
              edge="left"
              label="Ubah lebar panel Detail"
              width={rightPanel.width}
              min={RIGHT_PANEL.min}
              max={RIGHT_PANEL.max}
              onResize={rightPanel.setWidth}
              onCollapse={() => rightPanel.setCollapsed(true)}
              onReset={rightPanel.reset}
            />
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
        open={pendingDeleteUnit !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Hapus {pendingDeleteUnit?.name ?? 'bagian ini'}?
            </DialogTitle>
            <DialogDescription>
              {pendingDeleteUnit !== null
                ? `Ini juga menghapus ${Math.max(0, descendantsOf(draft.units, pendingDeleteUnit.id).size - 1)} sub-bagian beserta seluruh jabatannya. Penghapusan baru berlaku setelah Simpan dan bisa diurungkan sebelum itu.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="dark_blue_outline"
              onClick={() => setPendingDeleteId(null)}
            >
              Batal
            </Button>
            <Button variant="warning" onClick={handleConfirmChartDelete}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        draft={draft}
        placements={placements}
      />
    </>,
  );
}
