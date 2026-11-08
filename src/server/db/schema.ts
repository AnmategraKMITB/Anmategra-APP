import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { type AdapterAccount } from 'next-auth/adapters';

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `anmategra_${name}`);

const timestamps = {
  created_at: timestamp('created_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updated_at: timestamp('updated_at', {
    mode: 'date',
    withTimezone: true,
  })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

export const roleEnum = pgEnum('role', ['admin', 'lembaga', 'mahasiswa']);

export const users = createTable('user', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified', {
    mode: 'date',
    withTimezone: true,
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar('image', { length: 255 }),
  role: roleEnum('role').notNull().default('mahasiswa'),
  ...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  keanggotaan: many(keanggotaan),
  associationRequests: many(associationRequests),
  associationRequestsLembaga: many(associationRequestsLembaga),
  support: many(support),
  supportReplies: many(supportReplies),
  notifications: many(notifications),
  lembaga: many(lembaga),
  riwayatOrganisasi: many(riwayatOrganisasi),
  riwayatKepanitiaan: many(riwayatKepanitiaan),
}));

export const accounts = createTable(
  'account',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 })
      .$type<AdapterAccount['type']>()
      .notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', {
      length: 255,
    }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    id_token: text('id_token'),
    session_state: varchar('session_state', { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index('account_user_id_idx').on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  'session',
  {
    sessionToken: varchar('session_token', { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp('expires', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
  (session) => ({
    userIdIdx: index('session_user_id_idx').on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  'verification_token',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const mahasiswaStatusEnum = pgEnum('mahasiswa_status', [
  'aktif',
  'alumni',
]);

export const mahasiswa = createTable('mahasiswa', {
  userId: varchar('user_id', { length: 255 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nim: integer('nim').notNull(),
  nimTpb: integer('nim_tpb'),
  nama: varchar('nama', { length: 255 }),               // redundant column for performance
  jurusan: varchar('jurusan', { length: 255 }).notNull(),
  angkatan: integer('angkatan').notNull(),
  lineId: varchar('line_id', { length: 255 }),
  whatsapp: varchar('whatsapp', { length: 255 }),
  raporVisible: boolean('rapor_visible').notNull().default(true),
  status: mahasiswaStatusEnum('status').notNull().default('aktif'),
  ...timestamps,
});

// Alumni CSV upload fallback: NIM lulus yang belum punya akun terdaftar.
// Diterapkan otomatis (lalu dihapus) saat mahasiswa dengan NIM ini sign-in pertama kali.
export const alumniPending = createTable(
  'alumni_pending',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    nim: integer('nim').notNull(),
    wisudaBatch: varchar('wisuda_batch', { length: 100 }),
    uploadedBy: varchar('uploaded_by', { length: 255 })
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => ({
    nimUnique: uniqueIndex('alumni_pending_nim_unique').on(table.nim),
  }),
);

export const mahasiswaRelations = relations(mahasiswa, ({ one, many }) => ({
  users: one(users, {
    fields: [mahasiswa.userId],
    references: [users.id],
  }),

  bestStaffKegiatan: many(bestStaffKegiatan),
  bestStaffLembaga: many(bestStaffLembaga),
  nilaiProfilKegiatan: many(nilaiProfilKegiatan),
  nilaiProfilLembaga: many(nilaiProfilLembaga),
}));

export const lembagaTypeEnum = pgEnum('lembaga_type', [
  'Himpunan',
  'UKM',
  'Kepanitiaan',
  'BSO',
  'Badan',
  'Pusat',
  'Organisasi',
]);

export const lembaga = createTable(
  'lembaga',
  {
    id: varchar('id', { length: 255 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // null = lembaga paling atas; jika induk dihapus, anak naik menjadi akar.
    parentId: varchar('parent_id', { length: 255 }).references(
      (): AnyPgColumn => lembaga.id,
      { onDelete: 'set null' },
    ),
    userId: varchar('user_id', { length: 255 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    acronym: varchar('acronym', { length: 50 }),
    description: text('description'),
    foundingDate: timestamp('founding_date', {
      mode: 'date',
      withTimezone: true,
    }),
    endingDate: timestamp('ending_date', {
      mode: 'date',
      withTimezone: true,
    }),
    type: lembagaTypeEnum('type').notNull().default('Organisasi'),
    major: varchar('major', { length: 255 }),
    field: varchar('field', { length: 255 }),
    memberCount: integer('member_count'),
    raporVisible: boolean('rapor_visible').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    parentIdx: index('lembaga_parent_id_idx').on(table.parentId),
  }),
);

export const lembagaRelations = relations(lembaga, ({ one, many }) => ({
  users: one(users, {
    fields: [lembaga.userId],
    references: [users.id],
  }),
  events: many(events),
  associationRequestsLembaga: many(associationRequestsLembaga),
  bestStaffLembaga: many(bestStaffLembaga),
  profilLembaga: many(profilLembaga),
  organizationStructures: many(organizationStructure),
  riwayatOrganisasi: many(riwayatOrganisasi),
}));

export const eventStatusEnum = pgEnum('event_status', [
  'Coming Soon',
  'On going',
  'Ended',
]);

// Tabel basis data: lembaga_period (sebelumnya event). Nama simbol TypeScript
// (`events`, `eventId`) sengaja dipertahankan di rilis 1A agar API tidak berubah.
// kepengurusan = periode kerja lembaga (mis. "2025/2026"); kegiatan = acara
// atau kepanitiaan yang tampil di daftar kegiatan publik.
export const LEMBAGA_PERIOD_KINDS = ['kegiatan', 'kepengurusan'] as const;
export type LembagaPeriodKind = (typeof LEMBAGA_PERIOD_KINDS)[number];

export const events = createTable(
  'lembaga_period',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    org_id: varchar('lembaga_id', { length: 255 }).references(() => lembaga.id),
    // CHECK kind IN (...) ditulis tangan di migrasi.
    kind: varchar('kind', { length: 32 })
      .$type<LembagaPeriodKind>()
      .notNull()
      .default('kegiatan'),
    // Label periode (mis. "2025/2026"); diisi migrasi, nullable sampai kode menulisnya.
    label: varchar('label', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    image: varchar('image', { length: 255 }),
    background_image: varchar('background_image', { length: 255 }),
    start_date: timestamp('start_date').notNull(),
    end_date: timestamp('end_date'),
    status: eventStatusEnum('status').notNull(),
    oprec_link: varchar('oprec_link', { length: 255 }),
    location: varchar('location', { length: 255 }),
    participant_limit: integer('participant_limit').notNull().default(0),
    participant_count: integer('participant_count').notNull().default(0),
    is_highlighted: boolean('is_highlighted').notNull().default(false),
    is_organogram: boolean('is_organogram').notNull().default(false),
    organogram_image: varchar('organogram_image', { length: 255 }),
    rapor_visible: boolean('rapor_visible').notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    uniqueHighlightedPerOrg: uniqueIndex('lembaga_period_highlighted_unique')
      .on(table.org_id)
      .where(sql`${table.is_highlighted} = true`),
  }),
);

export const eventsRelations = relations(events, ({ many, one }) => ({
  lembaga: one(lembaga, {
    fields: [events.org_id],
    references: [lembaga.id],
  }),
  keanggotaan: many(keanggotaan),
  associationRequests: many(associationRequests),
  bestStaffKegiatan: many(bestStaffKegiatan),
  profilKegiatan: many(profilKegiatan),
  organizationStructures: many(organizationStructure),
  riwayatKepanitiaan: many(riwayatKepanitiaan),
}));

// Enum for association request status
export const associationRequestStatusEnum = pgEnum(
  'association_request_status',
  ['Pending', 'Accepted', 'Declined'],
);

// Keanggotaan (Membership) Table
export const keanggotaan = createTable(
  'keanggotaan',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    event_id: varchar('period_id', { length: 255 })
      .references(() => events.id)
      .notNull(),
    user_id: varchar('user_id', { length: 255 })
      .references(() => users.id)
      .notNull(),
    org_unit_id: varchar('org_unit_id', { length: 255 }).references(
      () => organizationUnit.id,
      { onDelete: 'set null' },
    ),
    org_role_id: varchar('org_role_id', { length: 255 }).references(
      () => organizationRole.id,
      { onDelete: 'set null' },
    ),
    position: varchar('position', { length: 255 }).notNull(),
    division: varchar('division', { length: 255 }).notNull(),
    index: integer('index').notNull().default(0),
    description: text('description'),
    ...timestamps,
  },
  (table) => ({
    uniqueEventUser: uniqueIndex('keanggotaan_period_user_unique').on(
      table.event_id,
      table.user_id,
    ),
    // Postgres does not index the child side of a FK, and ON DELETE SET NULL
    // scans it on every organization_unit/_role delete.
    orgUnitIdx: index('keanggotaan_org_unit_idx').on(table.org_unit_id),
    orgRoleIdx: index('keanggotaan_org_role_idx').on(table.org_role_id),
  }),
);

// Association Request Table
export const associationRequests = createTable('association_request', {
  id: varchar('id', { length: 255 }).primaryKey(),
  event_id: varchar('period_id', { length: 255 }).references(() => events.id, {
    onDelete: 'cascade',
  }),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id, {
    onDelete: 'cascade',
  }),
  org_unit_id: varchar('org_unit_id', { length: 255 }).references(
    () => organizationUnit.id,
    { onDelete: 'set null' },
  ),
  org_role_id: varchar('org_role_id', { length: 255 }).references(
    () => organizationRole.id,
    { onDelete: 'set null' },
  ),
  position: varchar('position', { length: 255 }).notNull(),
  division: varchar('division', { length: 255 }).notNull(),
  status: associationRequestStatusEnum('status').notNull().default('Pending'),
  ...timestamps,
});

// Association Request Lembaga
export const associationRequestsLembaga = createTable(
  'association_request_lembaga',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
    ),
    user_id: varchar('user_id', { length: 255 }).references(() => users.id),
    org_unit_id: varchar('org_unit_id', { length: 255 }).references(
      () => organizationUnit.id,
      { onDelete: 'set null' },
    ),
    org_role_id: varchar('org_role_id', { length: 255 }).references(
      () => organizationRole.id,
      { onDelete: 'set null' },
    ),
    position: varchar('position', { length: 255 }).notNull(),
    division: varchar('division', { length: 255 }).notNull(),
    status: associationRequestStatusEnum('status').notNull().default('Pending'),
    ...timestamps,
  },
);

// Relations for Keanggotaan
export const keanggotaanRelations = relations(keanggotaan, ({ one }) => ({
  event: one(events, {
    fields: [keanggotaan.event_id],
    references: [events.id],
  }),
  user: one(users, {
    fields: [keanggotaan.user_id],
    references: [users.id],
  }),
}));

// Relations for Association Requests
export const associationRequestRelations = relations(
  associationRequests,
  ({ one }) => ({
    event: one(events, {
      fields: [associationRequests.event_id],
      references: [events.id],
    }),
    user: one(users, {
      fields: [associationRequests.user_id],
      references: [users.id],
    }),
  }),
);

export const associationRequestLembagaRelations = relations(
  associationRequestsLembaga,
  ({ one }) => ({
    lembaga: one(lembaga, {
      fields: [associationRequestsLembaga.lembagaId],
      references: [lembaga.id],
    }),
    user: one(users, {
      fields: [associationRequestsLembaga.user_id],
      references: [users.id],
    }),
  }),
);

// Enum for support ticket status
export const supportStatusEnum = pgEnum('support_status', [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
  'Draft',
  'Backlog',
  'Reported',
]);

export const supportUrgentEnum = pgEnum('support_urgent', [
  'Low',
  'Medium',
  'High',
]);

// Enum for notification type
export const notificationTypeEnum = pgEnum('notification_type', [
  'Association Request',
  'System',
]);

// Support Ticket Table
export const support = createTable('support', {
  id: varchar('id', { length: 255 }).primaryKey(),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  urgent: supportUrgentEnum('urgent').notNull().default('Low'),
  description: text('description').notNull(),
  status: supportStatusEnum('status').notNull().default('Draft'),
  attachment: varchar('attachment', { length: 255 }),
  ...timestamps,
});

// Support Reply Table
export const supportReplies = createTable('support_reply', {
  reply_id: varchar('reply_id', { length: 255 }).primaryKey(),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id),
  support_id: varchar('support_id', { length: 255 }).references(
    () => support.id,
  ),
  text: text('text').notNull(),
  ...timestamps,
});

// Notification Table
export const notifications = createTable('notification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  user_id: varchar('user_id', { length: 255 }).references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  type: notificationTypeEnum('type').notNull(),
  read: boolean('read').notNull().default(false),
  ...timestamps,
});

// Relations for Support
export const supportRelations = relations(support, ({ many, one }) => ({
  replies: many(supportReplies),
  user: one(users, {
    fields: [support.user_id],
    references: [users.id],
  }),
}));

// Relations for Support Replies
export const supportRepliesRelations = relations(supportReplies, ({ one }) => ({
  support: one(support, {
    fields: [supportReplies.support_id],
    references: [support.id],
  }),
  user: one(users, {
    fields: [supportReplies.user_id],
    references: [users.id],
  }),
}));

// Relations for Notifications
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
}));

// Verified Users table
export const verifiedUsers = createTable('verified_user', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull(),
});

// Kehimpunan Table
export const kehimpunan = createTable(
  'kehimpunan',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id),
    lembagaId: varchar('lembaga_id', { length: 255 })
      .notNull()
      .references(() => lembaga.id),
    org_unit_id: varchar('org_unit_id', { length: 255 }).references(
      () => organizationUnit.id,
      { onDelete: 'set null' },
    ),
    org_role_id: varchar('org_role_id', { length: 255 }).references(
      () => organizationRole.id,
      { onDelete: 'set null' },
    ),
    division: varchar('division', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    index: integer('index').notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    uniqueEventUser: uniqueIndex('kehimpunan_lembaga_user_unique').on(
      table.lembagaId,
      table.userId,
    ),
    // Postgres does not index the child side of a FK, and ON DELETE SET NULL
    // scans it on every organization_unit/_role delete.
    orgUnitIdx: index('kehimpunan_org_unit_idx').on(table.org_unit_id),
    orgRoleIdx: index('kehimpunan_org_role_idx').on(table.org_role_id),
  }),
);

export const kehimpunanRelations = relations(kehimpunan, ({ one }) => ({
  user: one(users, {
    fields: [kehimpunan.userId],
    references: [users.id],
  }),
  lembaga: one(lembaga, {
    fields: [kehimpunan.lembagaId],
    references: [lembaga.id],
  }),
}));

// Keanggotaan lembaga jangka panjang (terpisah dari jabatan per periode).
// Sementara diisi dari `kehimpunan` lewat trigger basis data (migrasi 0030);
// trigger dibuang saat `kehimpunan` digantikan oleh placement.
export const membershipStatusEnum = pgEnum('membership_status', [
  'aktif',
  'keluar',
]);

export const membershipSourceEnum = pgEnum('membership_source', [
  'import',
  'manual',
  'kaderisasi',
]);

export const lembagaMembership = createTable(
  'lembaga_membership',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    lembagaId: varchar('lembaga_id', { length: 255 })
      .notNull()
      .references(() => lembaga.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Angkatan masuk lembaga; bisa berbeda dari angkatan kuliah.
    cohortYear: integer('cohort_year'),
    cohortLabel: varchar('cohort_label', { length: 255 }),
    status: membershipStatusEnum('status').notNull().default('aktif'),
    source: membershipSourceEnum('source').notNull(),
    joinedAt: timestamp('joined_at', { mode: 'date', withTimezone: true }),
    endedAt: timestamp('ended_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    lembagaIdx: index('lembaga_membership_lembaga_idx').on(table.lembagaId),
    userIdx: index('lembaga_membership_user_idx').on(table.userId),
    // Paling banyak satu keanggotaan aktif per (lembaga, user).
    activeUnique: uniqueIndex('lembaga_membership_active_unique')
      .on(table.lembagaId, table.userId)
      .where(sql`${table.status} = 'aktif'`),
  }),
);

export const lembagaMembershipRelations = relations(
  lembagaMembership,
  ({ one }) => ({
    user: one(users, {
      fields: [lembagaMembership.userId],
      references: [users.id],
    }),
    lembaga: one(lembaga, {
      fields: [lembagaMembership.lembagaId],
      references: [lembaga.id],
    }),
  }),
);

// Organization Structure
export const organizationStructure = createTable(
  'organization_structure',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
      { onDelete: 'cascade' },
    ),
    eventId: varchar('period_id', { length: 255 }).references(() => events.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
    // Nama level per kedalaman, mis. ["Kemenkoan", "Kementerian"]; UI memakai
    // nama ini, bukan kata "unit". Null = pakai bawaan.
    levelLabels: jsonb('level_labels').$type<string[]>(),
    // Daftar rank berurutan (senior ke junior), mis. [{ id: "head", label: "Ketua" }, ...].
    // Null = daftar bawaan (DEFAULT_ORGANIZATION_RANKS).
    ranks: jsonb('ranks').$type<OrganizationRankDef[]>(),
    // Kunci edit: ketua dapat mematikan edit agar organogram tidak berubah.
    editLocked: boolean('edit_locked').notNull().default(false),
    // Naik satu setiap penyimpanan pohon; dipakai untuk mendeteksi dua orang yang
    // mengedit bersamaan (lebih andal daripada membandingkan timestamp).
    version: integer('version').notNull().default(0),
    lockedBy: varchar('locked_by', { length: 255 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    lockedAt: timestamp('locked_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    // A structure belongs to exactly one owner; the XOR itself is a CHECK
    // constraint hand-written in the migration (drizzle-kit cannot emit those).
    activeLembagaUnique: uniqueIndex(
      'organization_structure_active_lembaga_unique',
    )
      .on(table.lembagaId)
      .where(sql`${table.is_active} = true AND ${table.lembagaId} IS NOT NULL`),
    activeEventUnique: uniqueIndex(
      'organization_structure_active_period_unique',
    )
      .on(table.eventId)
      .where(sql`${table.is_active} = true AND ${table.eventId} IS NOT NULL`),
  }),
);

/**
 * Labels a unit carries. `level` is the unit's DEPTH in the tree (root = 1),
 * NOT a fixed function of `kind` — existing production data is flat, with
 * `Divisi` sitting at level 1 as a root. Ordering rules between kinds are
 * enforced in the router, not the database.
 */
export const ORGANIZATION_UNIT_KINDS = [
  'Bidang',
  'Divisi',
  'Subdivisi',
] as const;
export type OrganizationUnitKind = (typeof ORGANIZATION_UNIT_KINDS)[number];

export const ORGANIZATION_UNIT_MAX_LEVEL = 3;

// Organization Unit
export const organizationUnit = createTable(
  'organization_unit',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    structure_id: varchar('structure_id', { length: 255 })
      .references(() => organizationStructure.id, { onDelete: 'cascade' })
      .notNull(),
    // `no action` rather than `restrict`: restrict is checked immediately, so
    // cascading a structure delete into a multi-level tree would abort with
    // 23503 and make deleting a lembaga fail. `no action` defers the check to
    // end-of-statement, still rejecting a direct delete of a unit with children.
    parent_id: varchar('parent_id', { length: 255 }).references(
      (): AnyPgColumn => organizationUnit.id,
      { onDelete: 'no action' },
    ),
    name: varchar('name', { length: 255 }).notNull(),
    // Dibuang saat Fase 2D selesai; unit baru memakai `typeLabel` dan kolom ini null.
    kind: varchar('kind', { length: 255 }).$type<OrganizationUnitKind>(),
    // Kedalaman di pohon (akar = 1), tanpa batas atas sejak 0033; diisi editor baru.
    level: integer('level').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    // Label bebas pengganti `kind` (Bidang/Divisi/Subdivisi); `kind` dan `level`
    // dibuang saat router baru menggantikan yang lama (Fase 2B).
    typeLabel: varchar('type_label', { length: 255 }),
    // Deskripsi kerja bagian (apa yang dikerjakan); dipakai juga oleh formulir oprec nanti.
    description: text('description'),
    // Pengaturan tampilan editor (tata letak, tier, sisi, ...).
    layout: jsonb('layout').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => ({
    structureIdx: index('organization_unit_structure_idx').on(
      table.structure_id,
    ),
    parentIdx: index('organization_unit_parent_idx').on(table.parent_id),
    siblingOrderIdx: index('organization_unit_sibling_order_idx').on(
      table.structure_id,
      table.parent_id,
      table.sort_order,
    ),
  }),
);

// Organization Role
export const organizationRole = createTable(
  'organization_role',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    structure_id: varchar('structure_id', { length: 255 })
      .references(() => organizationStructure.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    ring_level: integer('ring_level').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    structureIdx: index('organization_role_structure_idx').on(
      table.structure_id,
    ),
  }),
);

// Posisi milik satu unit pada satu periode (tidak dipakai ulang antar periode).
// Menggantikan organization_role, yang menempel pada struktur dan bukan unit.
// Rank adalah urutan senioritas di dalam bagian dan bisa disusun per organogram
// (mis. menambah Sekretaris dan Bendahara di antara Wakil dan Staf). Posisi
// menyimpan id rank; daftar dan labelnya ada di organization_structure.ranks.
export type OrganizationRankDef = { id: string; label: string };
export type OrganizationPositionRank = string;
export const RANK_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Daftar rank bawaan, dipakai selama sebuah struktur belum menyusun daftarnya sendiri. */
export const DEFAULT_ORGANIZATION_RANKS: readonly OrganizationRankDef[] = [
  { id: 'head', label: 'Kepala' },
  { id: 'vice', label: 'Wakil' },
  { id: 'coordinator', label: 'Koordinator' },
  { id: 'staff', label: 'Staf' },
];

export const ORGANIZATION_POSITION_KINDS = [
  'struktural',
  'nonstruktural',
] as const;
export type OrganizationPositionKind =
  (typeof ORGANIZATION_POSITION_KINDS)[number];

export const organizationPosition = createTable(
  'organization_position',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Hapus unit menghapus posisinya, tetapi placement (on delete restrict)
    // menahan penghapusan selama masih ada orang di posisi itu.
    unitId: varchar('unit_id', { length: 255 })
      .notNull()
      .references(() => organizationUnit.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    rank: varchar('rank', { length: 32 })
      .$type<OrganizationPositionRank>()
      .notNull(),
    kind: varchar('kind', { length: 32 })
      .$type<OrganizationPositionKind>()
      .notNull()
      .default('struktural'),
    // 0 = tanpa batas. CHECK quota >= 0 ditulis tangan di migrasi; penegakan
    // batas dilakukan di aplikasi (di dalam transaksi), bukan trigger.
    quota: integer('quota').notNull().default(0),
    hidden: boolean('hidden').notNull().default(false),
    sort_order: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    unitIdx: index('organization_position_unit_idx').on(table.unitId),
  }),
);

export const placementSourceEnum = pgEnum('placement_source', [
  'oprec',
  'closerec',
  'manual',
  'import',
]);

// Orang sungguhan di sebuah posisi. Periode tidak disimpan: posisi > unit >
// struktur > periode. Satu orang boleh memegang beberapa posisi. Menggantikan
// keanggotaan dan kehimpunan (Fase 2D).
export const placement = createTable(
  'placement',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    positionId: varchar('position_id', { length: 255 })
      .notNull()
      .references(() => organizationPosition.id, { onDelete: 'restrict' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: placementSourceEnum('source').notNull(),
    // Kelak merujuk ke pilihan oprec yang menghasilkan penempatan ini; belum
    // ada FK karena tabel oprec belum ada.
    applicationChoiceId: varchar('application_choice_id', { length: 255 }),
    note: text('note'),
    // Urutan penempatan di daftar anggota periode (pengganti `index` keanggotaan).
    sortOrder: integer('sort_order').notNull().default(0),
    // Nullable agar data hasil migrasi/impor tetap bisa masuk.
    createdBy: varchar('created_by', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    ...timestamps,
  },
  (table) => ({
    positionUserUnique: uniqueIndex('placement_position_user_unique').on(
      table.positionId,
      table.userId,
    ),
    userIdx: index('placement_user_idx').on(table.userId),
  }),
);

export const organizationPositionRelations = relations(
  organizationPosition,
  ({ one, many }) => ({
    unit: one(organizationUnit, {
      fields: [organizationPosition.unitId],
      references: [organizationUnit.id],
    }),
    placements: many(placement),
  }),
);

export const placementRelations = relations(placement, ({ one }) => ({
  position: one(organizationPosition, {
    fields: [placement.positionId],
    references: [organizationPosition.id],
  }),
  user: one(users, {
    fields: [placement.userId],
    references: [users.id],
  }),
}));

// Best Staff
export const bestStaffKegiatan = createTable('best_staff_kegiatan', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: varchar('period_id', { length: 255 })
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  mahasiswaId: varchar('mahasiswa_id', { length: 255 })
    .references(() => mahasiswa.userId, { onDelete: 'cascade' })
    .notNull(),
  division: varchar('division', { length: 255 }).notNull(),
  startDate: timestamp('start_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  endDate: timestamp('end_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
});

export const bestStaffLembaga = createTable('best_staff_lembaga', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lembagaId: varchar('lembaga_id', { length: 255 })
    .references(() => lembaga.id, { onDelete: 'cascade' })
    .notNull(),
  mahasiswaId: varchar('mahasiswa_id', { length: 255 })
    .references(() => mahasiswa.userId, { onDelete: 'cascade' })
    .notNull(),
  division: varchar('division', { length: 255 }).notNull(),
  startDate: timestamp('start_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
  endDate: timestamp('end_date', {
    mode: 'date',
    withTimezone: true,
  }).notNull(),
});

export const bestStaffKegiatanRelations = relations(
  bestStaffKegiatan,
  ({ one }) => ({
    event: one(events, {
      fields: [bestStaffKegiatan.eventId],
      references: [events.id],
    }),
    mahasiswa: one(mahasiswa, {
      fields: [bestStaffKegiatan.mahasiswaId],
      references: [mahasiswa.userId],
    }),
  }),
);

export const bestStaffLembagaRelations = relations(
  bestStaffLembaga,
  ({ one }) => ({
    lembaga: one(lembaga, {
      fields: [bestStaffLembaga.lembagaId],
      references: [lembaga.id],
    }),
    mahasiswa: one(mahasiswa, {
      fields: [bestStaffLembaga.mahasiswaId],
      references: [mahasiswa.userId],
    }),
  }),
);

// Organization Structure Relations
export const organizationStructureRelations = relations(
  organizationStructure,
  ({ one, many }) => ({
    lembaga: one(lembaga, {
      fields: [organizationStructure.lembagaId],
      references: [lembaga.id],
    }),
    event: one(events, {
      fields: [organizationStructure.eventId],
      references: [events.id],
    }),
    units: many(organizationUnit),
    roles: many(organizationRole),
  }),
);

// Organization Unit Relations
export const organizationUnitRelations = relations(
  organizationUnit,
  ({ one, many }) => ({
    structure: one(organizationStructure, {
      fields: [organizationUnit.structure_id],
      references: [organizationStructure.id],
    }),
    parent: one(organizationUnit, {
      fields: [organizationUnit.parent_id],
      references: [organizationUnit.id],
      relationName: 'unitHierarchy',
    }),
    children: many(organizationUnit, { relationName: 'unitHierarchy' }),
  }),
);

// Organization Role Relations
export const organizationRoleRelations = relations(
  organizationRole,
  ({ one }) => ({
    structure: one(organizationStructure, {
      fields: [organizationRole.structure_id],
      references: [organizationStructure.id],
    }),
  }),
);

// Profil
export const profilKM = createTable('profil_km', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  description: text('description').notNull(),
});

export const profilKegiatan = createTable('profil_kegiatan', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: varchar('period_id', { length: 255 })
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
});

export const profilLembaga = createTable('profil_lembaga', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  lembagaId: varchar('lembaga_id', { length: 255 })
    .references(() => lembaga.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
});

export const pemetaanProfilKegiatan = createTable(
  'pemetaan_profil_kegiatan',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    profilKegiatanId: varchar('profil_kegiatan_id', { length: 255 })
      .references(() => profilKegiatan.id, { onDelete: 'cascade' })
      .notNull(),
    profilKMId: varchar('profil_km_id', { length: 255 })
      .references(() => profilKM.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    uniqueProfilKegiatanKM: uniqueIndex(
      'pemetaan_profil_kegiatan_profil_km_unique',
    ).on(table.profilKegiatanId, table.profilKMId),
  }),
);

export const pemetaanProfilLembaga = createTable(
  'pemetaan_profil_lembaga',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    profilLembagaId: varchar('profil_lembaga_id', { length: 255 })
      .references(() => profilLembaga.id, { onDelete: 'cascade' })
      .notNull(),
    profilKMId: varchar('profil_km_id', { length: 255 })
      .references(() => profilKM.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    uniqueProfilLembagaKM: uniqueIndex(
      'pemetaan_profil_lembaga_profil_km_unique',
    ).on(table.profilLembagaId, table.profilKMId),
  }),
);

export const nilaiProfilKegiatan = createTable(
  'nilai_profil_kegiatan',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    profilId: varchar('profil_id', { length: 255 })
      .references(() => profilKegiatan.id, { onDelete: 'cascade' })
      .notNull(),
    mahasiswaId: varchar('mahasiswa_id', { length: 255 })
      .references(() => mahasiswa.userId, { onDelete: 'cascade' })
      .notNull(),
    nilai: integer('nilai'),
  },
  (table) => {
    return {
      uniqueNilai: uniqueIndex('nilai_profil_kegiatan_unique').on(
        table.profilId,
        table.mahasiswaId,
      ),
    };
  },
);

export const nilaiProfilLembaga = createTable(
  'nilai_profil_lembaga',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    profilId: varchar('profil_id', { length: 255 })
      .references(() => profilLembaga.id, { onDelete: 'cascade' })
      .notNull(),
    mahasiswaId: varchar('mahasiswa_id', { length: 255 })
      .references(() => mahasiswa.userId, { onDelete: 'cascade' })
      .notNull(),
    nilai: integer('nilai'),
  },
  (table) => {
    return {
      uniqueNilai: uniqueIndex('nilai_profil_lembaga_unique').on(
        table.profilId,
        table.mahasiswaId,
      ),
    };
  },
);

export const profilKMRelations = relations(profilKM, ({ many }) => ({
  pemetaanProfilKegiatan: many(pemetaanProfilKegiatan),
  pemetaanProfilLembaga: many(pemetaanProfilLembaga),
}));

export const profilKegiatanRelations = relations(
  profilKegiatan,
  ({ one, many }) => ({
    pemetaanProfilKegiatan: many(pemetaanProfilKegiatan),
    event: one(events, {
      fields: [profilKegiatan.eventId],
      references: [events.id],
    }),
    nilaiProfilKegiatan: many(nilaiProfilKegiatan),
  }),
);

export const profilLembagaRelations = relations(
  profilLembaga,
  ({ one, many }) => ({
    pemetaanProfilLembaga: many(pemetaanProfilLembaga),
    lembaga: one(lembaga, {
      fields: [profilLembaga.lembagaId],
      references: [lembaga.id],
    }),
    nilaiProfilLembaga: many(nilaiProfilLembaga),
  }),
);

export const pemetaanProfilKegiatanRelations = relations(
  pemetaanProfilKegiatan,
  ({ one }) => ({
    profilKegiatan: one(profilKegiatan, {
      fields: [pemetaanProfilKegiatan.profilKegiatanId],
      references: [profilKegiatan.id],
    }),
    profilKM: one(profilKM, {
      fields: [pemetaanProfilKegiatan.profilKMId],
      references: [profilKM.id],
    }),
  }),
);

export const pemetaanProfilLembagaRelations = relations(
  pemetaanProfilLembaga,
  ({ one }) => ({
    profilLembaga: one(profilLembaga, {
      fields: [pemetaanProfilLembaga.profilLembagaId],
      references: [profilLembaga.id],
    }),
    profilKM: one(profilKM, {
      fields: [pemetaanProfilLembaga.profilKMId],
      references: [profilKM.id],
    }),
  }),
);

export const nilaiProfilKegiatanRelations = relations(
  nilaiProfilKegiatan,
  ({ one }) => ({
    profilKegiatan: one(profilKegiatan, {
      fields: [nilaiProfilKegiatan.profilId],
      references: [profilKegiatan.id],
    }),
    mahasiswa: one(mahasiswa, {
      fields: [nilaiProfilKegiatan.mahasiswaId],
      references: [mahasiswa.userId],
    }),
  }),
);

export const nilaiProfilLembagaRelations = relations(
  nilaiProfilLembaga,
  ({ one }) => ({
    profilLembaga: one(profilLembaga, {
      fields: [nilaiProfilLembaga.profilId],
      references: [profilLembaga.id],
    }),
    mahasiswa: one(mahasiswa, {
      fields: [nilaiProfilLembaga.mahasiswaId],
      references: [mahasiswa.userId],
    }),
  }),
);

// Riwayat (Histori Permanen) - H-03
//
// Snapshot yang di-insert di aplikasi (bukan DB trigger) setiap kali user
// keluar dari kehimpunan/keanggotaan, supaya histori tetap ada walau row
// membership-nya dihapus.
export const riwayatEndReasonEnum = pgEnum('riwayat_end_reason', [
  'removed',
  'left',
]);

export const riwayatOrganisasi = createTable(
  'riwayat_organisasi',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
      { onDelete: 'set null' },
    ),
    lembagaNama: varchar('lembaga_nama', { length: 255 }).notNull(),
    lembagaTipe: lembagaTypeEnum('lembaga_tipe'),
    division: varchar('division', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    startedAt: timestamp('started_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp('ended_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endReason: riwayatEndReasonEnum('end_reason').notNull(),
    ...timestamps,
  },
  (table) => ({
    userIdIdx: index('riwayat_organisasi_user_id_idx').on(table.userId),
  }),
);

export const riwayatOrganisasiRelations = relations(
  riwayatOrganisasi,
  ({ one }) => ({
    user: one(users, {
      fields: [riwayatOrganisasi.userId],
      references: [users.id],
    }),
    lembaga: one(lembaga, {
      fields: [riwayatOrganisasi.lembagaId],
      references: [lembaga.id],
    }),
  }),
);

export const riwayatKepanitiaan = createTable(
  'riwayat_kepanitiaan',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventId: varchar('period_id', { length: 255 }).references(() => events.id, {
      onDelete: 'set null',
    }),
    eventNama: varchar('event_nama', { length: 255 }).notNull(),
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
      { onDelete: 'set null' },
    ),
    lembagaNama: varchar('lembaga_nama', { length: 255 }),
    division: varchar('division', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    startedAt: timestamp('started_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp('ended_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endReason: riwayatEndReasonEnum('end_reason').notNull(),
    ...timestamps,
  },
  (table) => ({
    userIdIdx: index('riwayat_kepanitiaan_user_id_idx').on(table.userId),
  }),
);

export const riwayatKepanitiaanRelations = relations(
  riwayatKepanitiaan,
  ({ one }) => ({
    user: one(users, {
      fields: [riwayatKepanitiaan.userId],
      references: [users.id],
    }),
    event: one(events, {
      fields: [riwayatKepanitiaan.eventId],
      references: [events.id],
    }),
    lembaga: one(lembaga, {
      fields: [riwayatKepanitiaan.lembagaId],
      references: [lembaga.id],
    }),
  }),
);

// Admin Grant (Owner/Admin Lembaga & Kepanitiaan) - RO-03
//
// Owner Lembaga tetap akun `lembaga` existing (lembaga.userId). Admin adalah
// akun existing lain (biasanya role 'mahasiswa') yang di-grant akses kelola
// lembaga/event tertentu tanpa mengubah role top-level mereka.
export const adminGrantStatusEnum = pgEnum('admin_grant_status', [
  'active',
  'revoked',
]);

// Hibah akses menggantikan lembaga_admin dan event_admin (migrasi 0031).
// Scope: satu lembaga ATAU satu periode (CHECK access_grant_scope_xor ditulis
// tangan di migrasi, drizzle-kit tidak bisa membuatnya). `propagate` hanya
// berarti untuk scope lembaga: true = menjangkau semua lembaga turunan lewat
// lembaga.parent_id. `features` berisi kunci fitur; 'admin' = semua kemampuan
// admin yang ada sekarang. `can_grant`, `parent_grant_id`, `cascade_revoke`
// disiapkan untuk pendelegasian ulang dan belum dipakai kode.
export const accessGrant = createTable(
  'access_grant',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
      { onDelete: 'cascade' },
    ),
    periodId: varchar('period_id', { length: 255 }).references(
      () => events.id,
      { onDelete: 'cascade' },
    ),
    propagate: boolean('propagate').notNull().default(false),
    features: text('features')
      .array()
      .notNull()
      .default(sql`ARRAY['admin']::text[]`),
    canGrant: boolean('can_grant').notNull().default(false),
    parentGrantId: varchar('parent_grant_id', { length: 255 }).references(
      (): AnyPgColumn => accessGrant.id,
      { onDelete: 'set null' },
    ),
    cascadeRevoke: boolean('cascade_revoke').notNull().default(false),
    status: adminGrantStatusEnum('status').notNull().default('active'),
    // Nullable: hibah hasil migrasi tidak punya pemberi.
    grantedBy: varchar('granted_by', { length: 255 }).references(
      () => users.id,
    ),
    revokedAt: timestamp('revoked_at', {
      mode: 'date',
      withTimezone: true,
    }),
    revokedBy: varchar('revoked_by', { length: 255 }).references(
      () => users.id,
    ),
    ...timestamps,
  },
  (table) => ({
    userIdx: index('access_grant_user_idx').on(table.userId),
    lembagaIdx: index('access_grant_lembaga_idx').on(table.lembagaId),
    periodIdx: index('access_grant_period_idx').on(table.periodId),
    parentIdx: index('access_grant_parent_idx').on(table.parentGrantId),
    // Satu hibah per (penerima, scope); mencabut lalu memberi lagi memakai ulang barisnya.
    lembagaUserUnique: uniqueIndex('access_grant_lembaga_user_unique')
      .on(table.lembagaId, table.userId)
      .where(sql`${table.lembagaId} IS NOT NULL`),
    periodUserUnique: uniqueIndex('access_grant_period_user_unique')
      .on(table.periodId, table.userId)
      .where(sql`${table.periodId} IS NOT NULL`),
  }),
);

export const accessGrantRelations = relations(accessGrant, ({ one }) => ({
  user: one(users, {
    fields: [accessGrant.userId],
    references: [users.id],
  }),
  lembaga: one(lembaga, {
    fields: [accessGrant.lembagaId],
    references: [lembaga.id],
  }),
  period: one(events, {
    fields: [accessGrant.periodId],
    references: [events.id],
  }),
}));

// ---------------------------------------------------------------------------
// Dynamic Form Builder (#210)
//
// `status` and `type` are varchar + a hand-written CHECK (see the migration),
// not pgEnum: adding a value to a pgEnum and using it in the same migration
// batch fails on an empty database (the 0005/0006 incident), and new field
// types are expected later.
// ---------------------------------------------------------------------------

export const FORM_STATUSES = ['Draft', 'Published', 'Closed'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multiple_choice',
  'checkbox',
  'text_block',
  'link',
  'matrix',
  'scale',
  'file',
  // Pilihan divisi untuk form terikat oprec; paling banyak satu per form.
  'unit_choice',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const form = createTable(
  'form',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Exactly one of lembagaId / eventId is set (CHECK form_owner_xor).
    lembagaId: varchar('lembaga_id', { length: 255 }).references(
      () => lembaga.id,
      { onDelete: 'cascade' },
    ),
    eventId: varchar('period_id', { length: 255 }).references(() => events.id, {
      onDelete: 'cascade',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 16 })
      .$type<FormStatus>()
      .notNull()
      .default('Draft'),
    closesAt: timestamp('closes_at', { mode: 'date', withTimezone: true }),
    allowMultipleSubmissions: boolean('allow_multiple_submissions')
      .notNull()
      .default(false),
    /** Hanya sah bila `allowMultipleSubmissions` mati (CHECK di migrasi). */
    allowEditAfterSubmit: boolean('allow_edit_after_submit')
      .notNull()
      .default(false),
    /** `null` = tanpa kuota; CHECK (NULL atau > 0) di migrasi. */
    maxResponses: integer('max_responses'),
    publishedAt: timestamp('published_at', {
      mode: 'date',
      withTimezone: true,
    }),
    createdBy: varchar('created_by', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    // Public read-only preview link; the token is random and can be rotated.
    previewToken: varchar('preview_token', { length: 64 }),
    previewEnabled: boolean('preview_enabled').notNull().default(false),
    // Shapes are enforced by Zod in form.type.ts (FormSettingsSchema etc.).
    settings: jsonb('settings')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    theme: jsonb('theme')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    welcome: jsonb('welcome')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...timestamps,
  },
  (table) => ({
    lembagaIdx: index('form_lembaga_id_idx').on(table.lembagaId),
    eventIdx: index('form_period_id_idx').on(table.eventId),
    previewTokenUnique: uniqueIndex('form_preview_token_unique').on(
      table.previewToken,
    ),
  }),
);

export const formSection = createTable(
  'form_section',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    // No UNIQUE: reordering rewrites every row inside one transaction.
    // CHECK form_section_sort_order_check (>= 0) lives in the migration SQL.
    sortOrder: integer('sort_order').notNull(),
    /** Kondisi "tampil jika"; bentuknya divalidasi oleh `~/lib/forms/conditions`. */
    condition: jsonb('condition'),
    ...timestamps,
  },
  (table) => ({
    formOrderIdx: index('form_section_form_order_idx').on(
      table.formId,
      table.sortOrder,
    ),
  }),
);

export const formField = createTable(
  'form_field',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    // NULL = field outside any section (the group shown first).
    sectionId: varchar('section_id', { length: 255 }).references(
      () => formSection.id,
      { onDelete: 'set null' },
    ),
    type: varchar('type', { length: 32 }).$type<FormFieldType>().notNull(),
    label: varchar('label', { length: 500 }).notNull(),
    description: text('description'),
    required: boolean('required').notNull().default(false),
    // Per-type validation rules; the shape is enforced by Zod in form.type.ts.
    config: jsonb('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    // No UNIQUE: reordering rewrites every row inside one transaction.
    sortOrder: integer('sort_order').notNull(),
    // Set instead of deleting once the field has answers.
    /** Ilustrasi dekoratif `{ url, key, alt }` (UploadThing); bentuknya divalidasi di tipe API. */
    image: jsonb('image'),
    condition: jsonb('condition'),
    archivedAt: timestamp('archived_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    formSectionOrderIdx: index('form_field_form_section_order_idx').on(
      table.formId,
      table.sectionId,
      table.sortOrder,
    ),
    // Satu blok Pilihan (unit_choice) aktif per form.
    unitChoiceUnique: uniqueIndex('form_field_unit_choice_unique')
      .on(table.formId)
      .where(sql`${table.type} = 'unit_choice' AND ${table.archivedAt} IS NULL`),
  }),
);

/**
 * Berkas UploadThing milik satu form. Baris dibuat saat unggahan selesai,
 * sehingga menghapus gambar hanya bisa menyentuh berkas yang diunggah untuk
 * form itu — bukan kunci sembarang yang dikirim klien.
 */
export const formImage = createTable(
  'form_image',
  {
    key: varchar('key', { length: 255 }).notNull().primaryKey(),
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 2048 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    formIdx: index('form_image_form_id_idx').on(table.formId),
  }),
);

export const formFieldOption = createTable(
  'form_field_option',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fieldId: varchar('field_id', { length: 255 })
      .notNull()
      .references(() => formField.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').notNull(),
    archivedAt: timestamp('archived_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    fieldOrderIdx: index('form_field_option_field_order_idx').on(
      table.fieldId,
      table.sortOrder,
    ),
  }),
);

/**
 * Layar penutup setelah kirim. Yang bersyarat dan terpenuhi dipilih server
 * lebih dulu (menurut `sort_order`), lalu yang tanpa syarat.
 */
export const formEnding = createTable(
  'form_ending',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    // CHECK form_ending_sort_order_check (>= 0) lives in the migration SQL.
    sortOrder: integer('sort_order').notNull(),
    condition: jsonb('condition'),
    ...timestamps,
  },
  (table) => ({
    formOrderIdx: index('form_ending_form_order_idx').on(
      table.formId,
      table.sortOrder,
    ),
  }),
);

export const formSubmission = createTable(
  'form_submission',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endingId: varchar('ending_id', { length: 255 }).references(
      () => formEnding.id,
      { onDelete: 'set null' },
    ),
    submittedAt: timestamp('submitted_at', { mode: 'date', withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    /** Berubah saat pengisi menyunting jawaban; `submittedAt` tetap. */
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    formUserIdx: index('form_submission_form_user_idx').on(
      table.formId,
      table.userId,
    ),
  }),
);

/**
 * One row per answered field. `fieldLabel` / `fieldType` and the option labels
 * inside `value` are snapshots taken at submit time, so an answer stays
 * readable after its field is edited, archived or deleted.
 */
export const formAnswer = createTable(
  'form_answer',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: varchar('submission_id', { length: 255 })
      .notNull()
      .references(() => formSubmission.id, { onDelete: 'cascade' }),
    fieldId: varchar('field_id', { length: 255 }).references(
      () => formField.id,
      { onDelete: 'set null' },
    ),
    fieldLabel: varchar('field_label', { length: 500 }).notNull(),
    fieldType: varchar('field_type', { length: 32 })
      .$type<FormFieldType>()
      .notNull(),
    value: jsonb('value').notNull(),
  },
  (table) => ({
    submissionFieldUnique: uniqueIndex(
      'form_answer_submission_field_unique',
    ).on(table.submissionId, table.fieldId),
    fieldIdx: index('form_answer_field_id_idx').on(table.fieldId),
  }),
);

export const formRelations = relations(form, ({ one, many }) => ({
  lembaga: one(lembaga, {
    fields: [form.lembagaId],
    references: [lembaga.id],
  }),
  event: one(events, {
    fields: [form.eventId],
    references: [events.id],
  }),
  fields: many(formField),
  submissions: many(formSubmission),
}));

export const formFieldRelations = relations(formField, ({ one, many }) => ({
  form: one(form, {
    fields: [formField.formId],
    references: [form.id],
  }),
  options: many(formFieldOption),
}));

export const formFieldOptionRelations = relations(
  formFieldOption,
  ({ one }) => ({
    field: one(formField, {
      fields: [formFieldOption.fieldId],
      references: [formField.id],
    }),
  }),
);

export const formSubmissionRelations = relations(
  formSubmission,
  ({ one, many }) => ({
    form: one(form, {
      fields: [formSubmission.formId],
      references: [form.id],
    }),
    user: one(users, {
      fields: [formSubmission.userId],
      references: [users.id],
    }),
    answers: many(formAnswer),
  }),
);

export const formAnswerRelations = relations(formAnswer, ({ one }) => ({
  submission: one(formSubmission, {
    fields: [formAnswer.submissionId],
    references: [formSubmission.id],
  }),
  field: one(formField, {
    fields: [formAnswer.fieldId],
    references: [formField.id],
  }),
}));

// ---------------------------------------------------------------------------
// Oprec (open recruitment): inti pendaftaran
//
// Kolom berstatus memakai varchar + CHECK tulisan tangan di migrasi, bukan
// pgEnum (alasan yang sama dengan form_*): nilai baru akan datang di fase
// penilaian dan penempatan. Kuota divisi tidak diduplikasi; ia dibaca dari
// organization_position.quota.
// ---------------------------------------------------------------------------

export const RECRUITMENT_STATUSES = ['draft', 'open', 'closed'] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const PLACEMENT_STATES = ['berjalan', 'masa_banding', 'final'] as const;
export type PlacementState = (typeof PLACEMENT_STATES)[number];

export const SCORING_MODES = ['skor', 'keputusan_langsung'] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];

export const STATUS_METHODS = [
  'ambang',
  'peringkat_kuota',
  'peringkat_kuota_minimum',
] as const;
export type StatusMethod = (typeof STATUS_METHODS)[number];

export const SCORE_SOURCES = ['umum', 'divisi', 'gabungan'] as const;
export type ScoreSource = (typeof SCORE_SOURCES)[number];

export const ELIGIBILITY_MATCHES = ['all', 'any'] as const;
export type EligibilityMatch = (typeof ELIGIBILITY_MATCHES)[number];

export const ELIGIBILITY_ATTRIBUTES = [
  'angkatan_kuliah',
  'fakultas',
  'prodi',
  'status_mahasiswa',
  'keanggotaan_lembaga',
  'angkatan_lembaga',
] as const;
export type EligibilityAttribute = (typeof ELIGIBILITY_ATTRIBUTES)[number];

export const ELIGIBILITY_OPERATORS = [
  'eq',
  'neq',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'contains',
] as const;
export type EligibilityOperator = (typeof ELIGIBILITY_OPERATORS)[number];

export const APPLICATION_SOURCES = ['form', 'closerec'] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const CHOICE_ORIGINS = ['dipilih', 'dialihkan', 'closerec'] as const;
export type ChoiceOrigin = (typeof CHOICE_ORIGINS)[number];

export const COMPUTED_STATUSES = [
  'belum_lengkap',
  'perlu_ditinjau',
  'lolos',
  'tidak_lolos',
] as const;
export type ComputedStatus = (typeof COMPUTED_STATUSES)[number];

export const recruitment = createTable(
  'recruitment',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Periode lembaga yang menjalankan; form dan organogram mengikutinya.
    periodId: varchar('period_id', { length: 255 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    // Satu form hanya untuk satu oprec (unik); satu periode boleh banyak oprec.
    formId: varchar('form_id', { length: 255 })
      .notNull()
      .references(() => form.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 16 })
      .$type<RecruitmentStatus>()
      .notNull()
      .default('draft'),
    placementState: varchar('placement_state', { length: 16 })
      .$type<PlacementState>()
      .notNull()
      .default('berjalan'),
    resultsReleasedAt: timestamp('results_released_at', {
      mode: 'date',
      withTimezone: true,
    }),
    resultsVisibleToApplicants: boolean('results_visible_to_applicants')
      .notNull()
      .default(false),
    setupCompletedAt: timestamp('setup_completed_at', {
      mode: 'date',
      withTimezone: true,
    }),
    /** Jawaban mentah wizard setup, disimpan untuk riwayat. */
    setupAnswers: jsonb('setup_answers').$type<Record<string, unknown>>(),
    // CHECK: 1 <= min_choices <= max_choices.
    minChoices: integer('min_choices').notNull().default(1),
    maxChoices: integer('max_choices').notNull().default(3),
    allowRedirect: boolean('allow_redirect').notNull().default(false),
    scoringMode: varchar('scoring_mode', { length: 24 })
      .$type<ScoringMode>()
      .notNull()
      .default('skor'),
    statusMethod: varchar('status_method', { length: 32 })
      .$type<StatusMethod>()
      .notNull()
      .default('peringkat_kuota_minimum'),
    statusMinScore: integer('status_min_score').notNull().default(60),
    scoreSource: varchar('score_source', { length: 16 })
      .$type<ScoreSource>()
      .notNull()
      .default('gabungan'),
    /** Bobot nilai umum (0-100) untuk sumber gabungan; sisanya nilai divisi. */
    weightUmum: integer('weight_umum').notNull().default(50),
    ratingMin: integer('rating_min').notNull().default(1),
    ratingMax: integer('rating_max').notNull().default(5),
    minReviewers: integer('min_reviewers').notNull().default(1),
    blind: boolean('blind').notNull().default(false),
    allowEarlyAssessment: boolean('allow_early_assessment')
      .notNull()
      .default(false),
    visibilityDefault: boolean('visibility_default').notNull().default(false),
    eligibilityMatch: varchar('eligibility_match', { length: 8 })
      .$type<EligibilityMatch>()
      .notNull()
      .default('all'),
    ...timestamps,
  },
  (table) => ({
    periodIdx: index('recruitment_period_idx').on(table.periodId),
    formUnique: uniqueIndex('recruitment_form_unique').on(table.formId),
  }),
);

export const recruitmentWave = createTable(
  'recruitment_wave',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recruitmentId: varchar('recruitment_id', { length: 255 })
      .notNull()
      .references(() => recruitment.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 255 }).notNull(),
    // CHECK: ends_at > starts_at.
    startsAt: timestamp('starts_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    endsAt: timestamp('ends_at', {
      mode: 'date',
      withTimezone: true,
    }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => ({
    recruitmentIdx: index('recruitment_wave_recruitment_idx').on(
      table.recruitmentId,
    ),
  }),
);

export const recruitmentEligibilityRule = createTable(
  'recruitment_eligibility_rule',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recruitmentId: varchar('recruitment_id', { length: 255 })
      .notNull()
      .references(() => recruitment.id, { onDelete: 'cascade' }),
    attribute: varchar('attribute', { length: 32 })
      .$type<EligibilityAttribute>()
      .notNull(),
    op: varchar('op', { length: 16 }).$type<EligibilityOperator>().notNull(),
    /** Bentuknya divalidasi Zod di oprec.type.ts menurut `op`. */
    value: jsonb('value').$type<unknown>().notNull(),
  },
  (table) => ({
    recruitmentIdx: index('recruitment_eligibility_rule_recruitment_idx').on(
      table.recruitmentId,
    ),
  }),
);

export const recruitmentDivision = createTable(
  'recruitment_division',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recruitmentId: varchar('recruitment_id', { length: 255 })
      .notNull()
      .references(() => recruitment.id, { onDelete: 'cascade' }),
    // Restrict: menghapus bagian/posisi yang sedang dibuka harus ditolak
    // sampai ia dikeluarkan dari oprec lebih dulu.
    unitId: varchar('unit_id', { length: 255 })
      .notNull()
      .references(() => organizationUnit.id, { onDelete: 'restrict' }),
    positionId: varchar('position_id', { length: 255 })
      .notNull()
      .references(() => organizationPosition.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 50 }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => ({
    unitIdx: index('recruitment_division_unit_idx').on(table.unitId),
    positionIdx: index('recruitment_division_position_idx').on(
      table.positionId,
    ),
    recruitmentUnitUnique: uniqueIndex(
      'recruitment_division_recruitment_unit_unique',
    ).on(table.recruitmentId, table.unitId),
  }),
);

export const recruitmentSectionBinding = createTable(
  'recruitment_section_binding',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recruitmentId: varchar('recruitment_id', { length: 255 })
      .notNull()
      .references(() => recruitment.id, { onDelete: 'cascade' }),
    formSectionId: varchar('form_section_id', { length: 255 })
      .notNull()
      .references(() => formSection.id, { onDelete: 'cascade' }),
    divisionId: varchar('division_id', { length: 255 })
      .notNull()
      .references(() => recruitmentDivision.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    divisionIdx: index('recruitment_section_binding_division_idx').on(
      table.divisionId,
    ),
    bindingUnique: uniqueIndex('recruitment_section_binding_unique').on(
      table.recruitmentId,
      table.formSectionId,
      table.divisionId,
    ),
  }),
);

export const application = createTable(
  'application',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recruitmentId: varchar('recruitment_id', { length: 255 })
      .notNull()
      .references(() => recruitment.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    waveId: varchar('wave_id', { length: 255 }).references(
      () => recruitmentWave.id,
      { onDelete: 'set null' },
    ),
    // Null untuk closerec. Respons yang dihapus tidak boleh menghapus pendaftar.
    formSubmissionId: varchar('form_submission_id', {
      length: 255,
    }).references(() => formSubmission.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 16 })
      .$type<ApplicationSource>()
      .notNull(),
    willingToMove: boolean('willing_to_move').notNull().default(false),
    submittedAt: timestamp('submitted_at', {
      mode: 'date',
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => ({
    userIdx: index('application_user_idx').on(table.userId),
    waveIdx: index('application_wave_idx').on(table.waveId),
    recruitmentUserUnique: uniqueIndex('application_recruitment_user_unique').on(
      table.recruitmentId,
      table.userId,
    ),
    submissionUnique: uniqueIndex('application_form_submission_unique')
      .on(table.formSubmissionId)
      .where(sql`${table.formSubmissionId} IS NOT NULL`),
  }),
);

export const applicationChoice = createTable(
  'application_choice',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: varchar('application_id', { length: 255 })
      .notNull()
      .references(() => application.id, { onDelete: 'cascade' }),
    divisionId: varchar('division_id', { length: 255 })
      .notNull()
      .references(() => recruitmentDivision.id, { onDelete: 'restrict' }),
    // 1..N; null untuk closerec atau pilihan yang dialihkan. CHECK rank >= 1.
    rank: integer('rank'),
    origin: varchar('origin', { length: 16 }).$type<ChoiceOrigin>().notNull(),
    // Cache; dihitung ulang dari penilaian pada fase berikutnya.
    score: numeric('score'),
    computedStatus: varchar('computed_status', {
      length: 16,
    }).$type<ComputedStatus>(),
    scoredAt: timestamp('scored_at', { mode: 'date', withTimezone: true }),
  },
  (table) => ({
    divisionIdx: index('application_choice_division_idx').on(table.divisionId),
    applicationDivisionUnique: uniqueIndex(
      'application_choice_application_division_unique',
    ).on(table.applicationId, table.divisionId),
    // Banyak baris dengan rank NULL boleh; yang berurutan harus unik.
    applicationRankUnique: uniqueIndex('application_choice_application_rank_unique')
      .on(table.applicationId, table.rank)
      .where(sql`${table.rank} IS NOT NULL`),
  }),
);

export const recruitmentRelations = relations(recruitment, ({ one, many }) => ({
  period: one(events, {
    fields: [recruitment.periodId],
    references: [events.id],
  }),
  form: one(form, { fields: [recruitment.formId], references: [form.id] }),
  waves: many(recruitmentWave),
  eligibilityRules: many(recruitmentEligibilityRule),
  divisions: many(recruitmentDivision),
  applications: many(application),
}));

export const recruitmentWaveRelations = relations(
  recruitmentWave,
  ({ one }) => ({
    recruitment: one(recruitment, {
      fields: [recruitmentWave.recruitmentId],
      references: [recruitment.id],
    }),
  }),
);

export const recruitmentEligibilityRuleRelations = relations(
  recruitmentEligibilityRule,
  ({ one }) => ({
    recruitment: one(recruitment, {
      fields: [recruitmentEligibilityRule.recruitmentId],
      references: [recruitment.id],
    }),
  }),
);

export const recruitmentDivisionRelations = relations(
  recruitmentDivision,
  ({ one, many }) => ({
    recruitment: one(recruitment, {
      fields: [recruitmentDivision.recruitmentId],
      references: [recruitment.id],
    }),
    unit: one(organizationUnit, {
      fields: [recruitmentDivision.unitId],
      references: [organizationUnit.id],
    }),
    position: one(organizationPosition, {
      fields: [recruitmentDivision.positionId],
      references: [organizationPosition.id],
    }),
    bindings: many(recruitmentSectionBinding),
  }),
);

export const recruitmentSectionBindingRelations = relations(
  recruitmentSectionBinding,
  ({ one }) => ({
    division: one(recruitmentDivision, {
      fields: [recruitmentSectionBinding.divisionId],
      references: [recruitmentDivision.id],
    }),
    section: one(formSection, {
      fields: [recruitmentSectionBinding.formSectionId],
      references: [formSection.id],
    }),
  }),
);

export const applicationRelations = relations(application, ({ one, many }) => ({
  recruitment: one(recruitment, {
    fields: [application.recruitmentId],
    references: [recruitment.id],
  }),
  user: one(users, { fields: [application.userId], references: [users.id] }),
  wave: one(recruitmentWave, {
    fields: [application.waveId],
    references: [recruitmentWave.id],
  }),
  submission: one(formSubmission, {
    fields: [application.formSubmissionId],
    references: [formSubmission.id],
  }),
  choices: many(applicationChoice),
}));

export const applicationChoiceRelations = relations(
  applicationChoice,
  ({ one }) => ({
    application: one(application, {
      fields: [applicationChoice.applicationId],
      references: [application.id],
    }),
    division: one(recruitmentDivision, {
      fields: [applicationChoice.divisionId],
      references: [recruitmentDivision.id],
    }),
  }),
);
