import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type * as schema from '~/server/db/schema';
import {
  organizationRole,
  organizationStructure,
  organizationUnit,
} from '~/server/db/schema';

/** `ctx.db` atau transaksi `tx` di dalam `ctx.db.transaction(...)`. */
type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

/**
 * Sisa dari router organogram lama (Fase 2B menggantikan router-nya). Hanya
 * `resolveOrgAssignment` yang masih dipakai, oleh alur anggota lama
 * (`event/update`, `lembaga`) yang menulis keanggotaan.org_unit_id; dibuang di 2D.
 */

/**
 * Kode SQLSTATE dari galat basis data. Drizzle (>= 0.44) membungkus galat Postgres
 * dalam `DrizzleQueryError` dan menaruh aslinya di `cause`, jadi `error.code` di
 * puncak kosong; telusuri rantai `cause` (dibatasi, aman dari siklus).
 */
function pgErrorCode(error: unknown): string | undefined {
  let cursor: unknown = error;
  for (let depth = 0; depth < 5 && cursor && typeof cursor === 'object'; depth++) {
    const code = (cursor as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Postgres unique_violation: duplikat yang harus tampil ke pemanggil sebagai CONFLICT. */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23505';
}

/** Postgres foreign_key_violation, mis. menghapus posisi yang masih berpenghuni. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === '23503';
}

export type OrgAssignment = {
  org_unit_id: string | null;
  org_role_id: string | null;
  division?: string;
  position?: string;
};

/**
 * Dipakai oleh alur penulisan anggota lama (keanggotaan/kehimpunan).
 *
 * Org ids are authoritative when present: the caller's `division`/`position`
 * strings are overwritten with the unit/role names so the denormalized text
 * columns cannot drift from the rows they mirror.
 */
export async function resolveOrgAssignment(
  db: Db,
  opts: {
    ownerType: 'lembaga' | 'event';
    ownerId: string;
    org_unit_id?: string | null;
    org_role_id?: string | null;
  },
): Promise<OrgAssignment> {
  const { org_unit_id = null, org_role_id = null } = opts;
  if (!org_unit_id && !org_role_id) {
    return { org_unit_id: null, org_role_id: null };
  }

  const ownerMatches = (s: {
    lembagaId: string | null;
    eventId: string | null;
  }) =>
    opts.ownerType === 'lembaga'
      ? s.lembagaId === opts.ownerId
      : s.eventId === opts.ownerId;

  const result: OrgAssignment = { org_unit_id, org_role_id };
  let unitStructureId: string | null = null;
  let roleStructureId: string | null = null;

  if (org_unit_id) {
    const rows = await db
      .select({
        name: organizationUnit.name,
        structureId: organizationStructure.id,
        lembagaId: organizationStructure.lembagaId,
        eventId: organizationStructure.eventId,
        is_active: organizationStructure.is_active,
      })
      .from(organizationUnit)
      .innerJoin(
        organizationStructure,
        eq(organizationUnit.structure_id, organizationStructure.id),
      )
      .where(eq(organizationUnit.id, org_unit_id))
      .limit(1);

    const unit = rows[0];
    if (!unit) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Unit tidak ditemukan.',
      });
    }
    if (!ownerMatches(unit)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Unit tersebut bukan milik lembaga/kegiatan ini.',
      });
    }
    if (!unit.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Struktur organisasi unit tersebut sudah tidak aktif.',
      });
    }
    unitStructureId = unit.structureId;
    result.division = unit.name;
  }

  if (org_role_id) {
    const rows = await db
      .select({
        name: organizationRole.name,
        structureId: organizationStructure.id,
        lembagaId: organizationStructure.lembagaId,
        eventId: organizationStructure.eventId,
        is_active: organizationStructure.is_active,
      })
      .from(organizationRole)
      .innerJoin(
        organizationStructure,
        eq(organizationRole.structure_id, organizationStructure.id),
      )
      .where(eq(organizationRole.id, org_role_id))
      .limit(1);

    const role = rows[0];
    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Posisi tidak ditemukan.',
      });
    }
    if (!ownerMatches(role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Posisi tersebut bukan milik lembaga/kegiatan ini.',
      });
    }
    if (!role.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Struktur organisasi posisi tersebut sudah tidak aktif.',
      });
    }
    roleStructureId = role.structureId;
    result.position = role.name;
  }

  if (
    unitStructureId &&
    roleStructureId &&
    unitStructureId !== roleStructureId
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Unit dan posisi harus berasal dari struktur yang sama.',
    });
  }

  return result;
}
