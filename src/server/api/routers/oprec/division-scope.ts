import { TRPCError } from '@trpc/server';
import { type AssessorMode, type PlacementState } from '~/server/db/schema';

/**
 * Cakupan ubah pengaturan per divisi (kriteria dan penilai tambahan).
 * Pengelola oprec mencakup semua divisi dan kriteria Umum; pengurus hanya
 * divisi yang ia pegang di organogram (lihat `pengurus.ts`).
 */
export type DivisionScope =
  { isAdmin: true } | { isAdmin: false; divisionIds: Set<string> };

/**
 * Cakupan seseorang atas satu oprec, atau `null` bila tidak boleh mengubah.
 * Pengurus kehilangan hak ini bila pengurus tidak ikut menilai
 * (`assessorMode = 'umum'`) atau penempatan sudah Final; admin tidak.
 */
export function resolveDivisionScope(input: {
  isAdmin: boolean;
  assessorMode: AssessorMode;
  placementState: PlacementState;
  pengurusDivisionIds: string[];
}): DivisionScope | null {
  if (input.isAdmin) return { isAdmin: true };
  if (input.assessorMode === 'umum') return null;
  if (input.placementState === 'final') return null;
  if (input.pengurusDivisionIds.length === 0) return null;
  return { isAdmin: false, divisionIds: new Set(input.pengurusDivisionIds) };
}

/** `divisionId = null` = kriteria atau penilai Umum, hanya untuk admin. */
export function canEditDivision(
  scope: DivisionScope,
  divisionId: string | null,
): boolean {
  if (scope.isAdmin) return true;
  return divisionId !== null && scope.divisionIds.has(divisionId);
}

export function assertCanEditDivision(
  scope: DivisionScope,
  divisionId: string | null,
) {
  if (canEditDivision(scope, divisionId)) return;
  throw new TRPCError({
    code: 'FORBIDDEN',
    message:
      divisionId === null
        ? 'Kriteria dan penilai umum hanya bisa diubah pengelola oprec.'
        : 'Kamu hanya bisa mengubah pengaturan divisi yang kamu pegang.',
  });
}
