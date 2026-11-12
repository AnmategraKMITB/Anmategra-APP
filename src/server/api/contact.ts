import { and, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';

import { type db } from '~/server/db';
import {
  adminPermission,
  application,
  associationRequests,
  associationRequestsLembaga,
  events,
  lembagaMembership,
  organizationPosition,
  organizationStructure,
  organizationUnit,
  placement,
  recruitment,
} from '~/server/db/schema';

import { hasAdminPermission } from './admin-permissions';
import { canManageEvent, canManageLembaga } from './access';

/**
 * Visibilitas kontak mahasiswa. Satu-satunya penentu siapa boleh melihat
 * WhatsApp, ID LINE, dan email seorang mahasiswa.
 *
 * Selalu boleh: pemilik akun, Superadmin, Operator dengan izin `accounts.read`,
 * serta Owner dan Admin penuh dari lembaga atau kegiatan tempat mahasiswa itu
 * terlibat (anggota aktif, panitia kegiatan yang belum selesai, pengaju
 * asosiasi yang masih diproses, dan pelamar oprec yang belum final).
 * Selain itu, bidang hanya terlihat bila pemilik menyalakan togglenya.
 */

export type ContactField = 'whatsapp' | 'line' | 'email';

export type ContactViewer = {
  id: string;
  role: string;
  lembagaId?: string | null;
};

export type ContactToggles = {
  userId: string;
  showWhatsapp: boolean;
  showLine: boolean;
  showEmail: boolean;
};

type Database = typeof db;

async function hasOperatorPermission(
  database: Database,
  userId: string,
  required: Parameters<typeof hasAdminPermission>[1],
): Promise<boolean> {
  const row = await database.query.adminPermission.findFirst({
    where: and(
      eq(adminPermission.userId, userId),
      isNull(adminPermission.revokedAt),
      or(
        isNull(adminPermission.expiresAt),
        gt(adminPermission.expiresAt, new Date()),
      ),
    ),
    columns: { permissions: true },
  });
  return hasAdminPermission(row?.permissions, required);
}

/** Lembaga dan kegiatan tempat seorang mahasiswa terlibat saat ini. */
async function involvedScopes(database: Database, userId: string) {
  const [members, placed, assocEvents, assocLembaga, applied] =
    await Promise.all([
      database
        .select({ lembagaId: lembagaMembership.lembagaId })
        .from(lembagaMembership)
        .where(
          and(
            eq(lembagaMembership.userId, userId),
            eq(lembagaMembership.status, 'aktif'),
          ),
        ),
      database
        .selectDistinct({ eventId: events.id })
        .from(placement)
        .innerJoin(
          organizationPosition,
          eq(placement.positionId, organizationPosition.id),
        )
        .innerJoin(
          organizationUnit,
          eq(organizationPosition.unitId, organizationUnit.id),
        )
        .innerJoin(
          organizationStructure,
          and(
            eq(organizationStructure.id, organizationUnit.structure_id),
            eq(organizationStructure.is_active, true),
          ),
        )
        .innerJoin(events, eq(events.id, organizationStructure.eventId))
        .where(and(eq(placement.userId, userId), ne(events.status, 'Ended'))),
      database
        .select({ eventId: associationRequests.event_id })
        .from(associationRequests)
        .where(
          and(
            eq(associationRequests.user_id, userId),
            eq(associationRequests.status, 'Pending'),
          ),
        ),
      database
        .select({ lembagaId: associationRequestsLembaga.lembagaId })
        .from(associationRequestsLembaga)
        .where(
          and(
            eq(associationRequestsLembaga.user_id, userId),
            eq(associationRequestsLembaga.status, 'Pending'),
          ),
        ),
      database
        .select({ periodId: recruitment.periodId })
        .from(application)
        .innerJoin(recruitment, eq(recruitment.id, application.recruitmentId))
        .where(
          and(
            eq(application.userId, userId),
            ne(recruitment.status, 'draft'),
            ne(recruitment.placementState, 'final'),
          ),
        ),
    ]);

  const lembagaIds = new Set<string>();
  for (const m of members) lembagaIds.add(m.lembagaId);
  for (const a of assocLembaga) if (a.lembagaId) lembagaIds.add(a.lembagaId);

  const eventIds = new Set<string>();
  for (const p of placed) eventIds.add(p.eventId);
  for (const a of assocEvents) if (a.eventId) eventIds.add(a.eventId);
  for (const a of applied) eventIds.add(a.periodId);

  return { lembagaIds: [...lembagaIds], eventIds: [...eventIds] };
}

/** Apakah `viewer` Owner atau Admin penuh dari salah satu lembaga/kegiatan yang melibatkan mahasiswa. */
async function managesInvolvement(
  database: Database,
  viewer: ContactViewer,
  targetUserId: string,
): Promise<boolean> {
  const { lembagaIds, eventIds } = await involvedScopes(database, targetUserId);
  if (lembagaIds.length === 0 && eventIds.length === 0) return false;

  const eventRows =
    eventIds.length === 0
      ? []
      : await database
          .select({ id: events.id, orgId: events.org_id })
          .from(events)
          .where(inArray(events.id, eventIds));

  // Jalur cepat Owner: tanpa kueri tambahan.
  if (viewer.role === 'lembaga' && viewer.lembagaId) {
    const owned =
      lembagaIds.includes(viewer.lembagaId) ||
      eventRows.some((e) => e.orgId === viewer.lembagaId);
    if (owned) return true;
  }

  const sessionLembagaId = viewer.lembagaId ?? null;
  for (const lembagaId of lembagaIds) {
    if (
      await canManageLembaga(
        database,
        viewer.id,
        viewer.role,
        sessionLembagaId,
        lembagaId,
      )
    ) {
      return true;
    }
  }
  for (const event of eventRows) {
    if (
      await canManageEvent(
        database,
        viewer.id,
        viewer.role,
        sessionLembagaId,
        event.id,
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Boleh melihat akun yang disembunyikan (`users.hidden_at`): pemilik akun,
 * Superadmin, dan Operator dengan izin `accounts.read`.
 */
export async function canViewHiddenAccount(
  database: Database,
  viewer: ContactViewer,
  targetUserId: string,
): Promise<boolean> {
  if (viewer.id === targetUserId) return true;
  if (viewer.role === 'admin') return true;
  return hasOperatorPermission(database, viewer.id, 'accounts.read');
}

async function hasFullContactAccess(
  database: Database,
  viewer: ContactViewer,
  targetUserId: string,
): Promise<boolean> {
  if (await canViewHiddenAccount(database, viewer, targetUserId)) return true;
  return managesInvolvement(database, viewer, targetUserId);
}

/** Bidang kontak mana saja yang boleh dilihat `viewer` pada mahasiswa `target`. */
export async function contactAccess(
  database: Database,
  viewer: ContactViewer,
  target: ContactToggles,
): Promise<Record<ContactField, boolean>> {
  const everythingShown =
    target.showWhatsapp && target.showLine && target.showEmail;
  // Kueri izin hanya dijalankan bila ada bidang yang disembunyikan.
  const full =
    everythingShown ||
    (await hasFullContactAccess(database, viewer, target.userId));
  return {
    whatsapp: full || target.showWhatsapp,
    line: full || target.showLine,
    email: full || target.showEmail,
  };
}

export async function canViewContact(
  database: Database,
  viewer: ContactViewer,
  target: ContactToggles,
  field: ContactField,
): Promise<boolean> {
  return (await contactAccess(database, viewer, target))[field];
}
