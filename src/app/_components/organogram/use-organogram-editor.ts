'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { type RouterOutputs, api } from '~/trpc/react';

import {
  type Draft,
  type EditorAction,
  type PlacementsByPosition,
  canRedo,
  canUndo,
  createHistory,
  editorReducer,
  isDirty,
  toDraft,
  toPlacements,
  toSavePayload,
  validateDraft,
} from './model';

export type OrganogramData = NonNullable<
  RouterOutputs['organization']['structure']['get']
>;

const EMPTY_DRAFT: Draft = {
  name: '',
  levelLabels: null,
  rankLabels: null,
  units: [],
  positions: [],
};

export type SaveResult =
  | { ok: true; changed: boolean }
  | { ok: false; kind: 'conflict' | 'invalid' | 'error'; message: string };

export type PlacementResult =
  | { ok: true }
  | { ok: false; kind: 'quota_full'; count: number; quota: number }
  | { ok: false; kind: 'error'; message: string };

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Terjadi kesalahan. Coba lagi.';
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const data = (error as { data?: { code?: unknown } }).data;
  return typeof data?.code === 'string' ? data.code : undefined;
}

/**
 * Menyatukan data server dan draf lokal. Perubahan pohon bersifat lokal sampai
 * `save()`; penempatan orang langsung ke server dan memuat ulang data tanpa
 * menyentuh draf. Bila orang lain menyimpan lebih dulu, draf yang sudah diubah
 * tidak diganti diam-diam: `stale` menjadi true dan pemakai memilih.
 */
export function useOrganogramEditor(periodId: string) {
  const utils = api.useUtils();
  const query = api.organization.structure.get.useQuery(
    { periodId },
    { refetchOnWindowFocus: false },
  );
  const data = query.data ?? null;

  const [history, dispatch] = useReducer(
    editorReducer,
    EMPTY_DRAFT,
    createHistory,
  );
  // Versi server yang drafnya sedang dipegang ("id:versi"); null = belum pernah memuat.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const serverKey = data ? `${data.id}:${data.version}` : null;
  const dirtyNow = isDirty(history);
  // Muat draf dari server saat pertama kali, atau saat versi berubah dan tidak
  // ada perubahan lokal. Dilakukan saat render (bukan di efek) dan dijaga agar
  // konvergen: setelah dimuat, serverKey sama dengan loadedKey.
  if (data && serverKey !== loadedKey && (loadedKey === null || !dirtyNow)) {
    setLoadedKey(serverKey);
    dispatch({ type: 'load', draft: toDraft(data) });
  }
  // Orang lain menyimpan lebih dulu sementara draf ini sudah diubah: jangan ganti diam-diam.
  const stale =
    data !== null && loadedKey !== null && serverKey !== loadedKey && dirtyNow;

  const dirty = dirtyNow;

  // Peringatan bawaan peramban saat menutup tab dengan perubahan belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // beforeunload tidak terpicu oleh <Link> Next.js; tahan klik tautan internal.
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor?.href || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      if (
        !window.confirm('Ada perubahan belum disimpan. Tinggalkan halaman?')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', handler);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const saveMutation = api.organization.structure.save.useMutation();
  const createMutation = api.organization.structure.create.useMutation();
  const lockMutation = api.organization.structure.setLock.useMutation();
  const addMutation = api.organization.placement.add.useMutation();
  const removeMutation = api.organization.placement.remove.useMutation();
  const moveMutation = api.organization.placement.move.useMutation();

  const reload = useCallback(async () => {
    // staleTime 0: tanpa ini fetch bisa mengembalikan cache lama (default query client 30 detik).
    const fresh = await utils.organization.structure.get.fetch(
      { periodId },
      { staleTime: 0 },
    );
    if (!fresh) return;
    dispatch({ type: 'load', draft: toDraft(fresh) });
    setLoadedKey(`${fresh.id}:${fresh.version}`);
    setConflict(false);
  }, [utils, periodId]);

  const save = useCallback(async (): Promise<SaveResult> => {
    if (!data)
      return { ok: false, kind: 'error', message: 'Organogram belum dimuat.' };
    const problems = validateDraft(history.present);
    if (problems.length > 0) {
      return {
        ok: false,
        kind: 'invalid',
        message: problems.slice(0, 3).join(' '),
      };
    }
    try {
      const result = await saveMutation.mutateAsync({
        periodId,
        expectedVersion: data.version,
        ...toSavePayload(history.present),
      });
      await reload();
      return { ok: true, changed: result.changed };
    } catch (error) {
      if (
        codeOf(error) === 'CONFLICT' &&
        /sudah diubah orang lain/i.test(messageOf(error))
      ) {
        setConflict(true);
        return { ok: false, kind: 'conflict', message: messageOf(error) };
      }
      return { ok: false, kind: 'error', message: messageOf(error) };
    }
  }, [data, history.present, periodId, reload, saveMutation]);

  const create = useCallback(
    async (name?: string) => {
      await createMutation.mutateAsync({ periodId, name });
      await utils.organization.structure.get.invalidate({ periodId });
    },
    [createMutation, periodId, utils],
  );

  const setLocked = useCallback(
    async (locked: boolean) => {
      await lockMutation.mutateAsync({ periodId, locked });
      await utils.organization.structure.get.invalidate({ periodId });
    },
    [lockMutation, periodId, utils],
  );

  const refreshPlacements = useCallback(
    () => utils.organization.structure.get.invalidate({ periodId }),
    [utils, periodId],
  );

  const addPerson = useCallback(
    async (
      positionId: string,
      userId: string,
      allowOverQuota = false,
    ): Promise<PlacementResult> => {
      try {
        const result = await addMutation.mutateAsync({
          positionId,
          userId,
          allowOverQuota,
        });
        if (!result.ok) {
          return {
            ok: false,
            kind: 'quota_full',
            count: result.count,
            quota: result.quota,
          };
        }
        await refreshPlacements();
        return { ok: true };
      } catch (error) {
        return { ok: false, kind: 'error', message: messageOf(error) };
      }
    },
    [addMutation, refreshPlacements],
  );

  const removePerson = useCallback(
    async (placementId: string): Promise<PlacementResult> => {
      try {
        await removeMutation.mutateAsync({ placementId });
        await refreshPlacements();
        return { ok: true };
      } catch (error) {
        return { ok: false, kind: 'error', message: messageOf(error) };
      }
    },
    [removeMutation, refreshPlacements],
  );

  const movePerson = useCallback(
    async (
      placementId: string,
      toPositionId: string,
      allowOverQuota = false,
    ): Promise<PlacementResult> => {
      try {
        const result = await moveMutation.mutateAsync({
          placementId,
          toPositionId,
          allowOverQuota,
        });
        if (!result.ok) {
          return {
            ok: false,
            kind: 'quota_full',
            count: result.count,
            quota: result.quota,
          };
        }
        await refreshPlacements();
        return { ok: true };
      } catch (error) {
        return { ok: false, kind: 'error', message: messageOf(error) };
      }
    },
    [moveMutation, refreshPlacements],
  );

  const placements: PlacementsByPosition = useMemo(
    () => (data ? toPlacements(data) : {}),
    [data],
  );
  // Posisi yang sudah ada di server; hanya posisi ini yang bisa diisi orang.
  const persistedPositionIds = useMemo(
    () => new Set((data?.positions ?? []).map((position) => position.id)),
    [data],
  );

  return {
    isLoading: query.isLoading,
    error: query.error,
    /** null = periode ini belum punya organogram. */
    data,
    draft: history.present,
    dispatch: dispatch as (action: EditorAction) => void,
    dirty,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    stale,
    conflict,
    placements,
    persistedPositionIds,
    access: data?.access ?? null,
    editLocked: data?.editLocked ?? false,
    saving: saveMutation.isPending,
    save,
    reload,
    create,
    creating: createMutation.isPending,
    setLocked,
    addPerson,
    removePerson,
    movePerson,
  };
}

export type OrganogramEditor = ReturnType<typeof useOrganogramEditor>;
