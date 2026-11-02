import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
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
  lembagaAdminGrants: many(lembagaAdmin),
  eventAdminGrants: many(eventAdmin),
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
]);

export const lembaga = createTable('lembaga', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
  type: lembagaTypeEnum('type'),
  major: varchar('major', { length: 255 }),
  field: varchar('field', { length: 255 }),
  memberCount: integer('member_count'),
  raporVisible: boolean('rapor_visible').notNull().default(false),
  ...timestamps,
});

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
  lembagaAdmins: many(lembagaAdmin),
}));

export const eventStatusEnum = pgEnum('event_status', [
  'Coming Soon',
  'On going',
  'Ended',
]);

export const events = createTable(
  'event',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    org_id: varchar('org_id', { length: 255 }).references(() => lembaga.id),
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
    uniqueHighlightedPerOrg: uniqueIndex('event_org_highlighted_unique')
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
  eventAdmins: many(eventAdmin),
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
    event_id: varchar('event_id', { length: 255 })
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
    uniqueEventUser: uniqueIndex('keanggotaan_event_user_unique').on(
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
  event_id: varchar('event_id', { length: 255 }).references(() => events.id, {
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
    eventId: varchar('event_id', { length: 255 }).references(() => events.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    is_active: boolean('is_active').notNull().default(true),
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
    activeEventUnique: uniqueIndex('organization_structure_active_event_unique')
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
      () => organizationUnit.id,
      { onDelete: 'no action' },
    ),
    name: varchar('name', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 255 })
      .$type<OrganizationUnitKind>()
      .notNull(),
    level: integer('level').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
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

// Best Staff
export const bestStaffKegiatan = createTable('best_staff_kegiatan', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: varchar('event_id', { length: 255 })
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
  eventId: varchar('event_id', { length: 255 })
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
    eventId: varchar('event_id', { length: 255 }).references(
      () => events.id,
      { onDelete: 'set null' },
    ),
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

export const lembagaAdmin = createTable(
  'lembaga_admin',
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
    grantedBy: varchar('granted_by', { length: 255 })
      .notNull()
      .references(() => users.id),
    status: adminGrantStatusEnum('status').notNull().default('active'),
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
    lembagaUserUnique: uniqueIndex('lembaga_admin_lembaga_user_unique').on(
      table.lembagaId,
      table.userId,
    ),
    userIdIdx: index('lembaga_admin_user_id_idx').on(table.userId),
  }),
);

export const lembagaAdminRelations = relations(lembagaAdmin, ({ one }) => ({
  lembaga: one(lembaga, {
    fields: [lembagaAdmin.lembagaId],
    references: [lembaga.id],
  }),
  user: one(users, {
    fields: [lembagaAdmin.userId],
    references: [users.id],
  }),
}));

export const eventAdmin = createTable(
  'event_admin',
  {
    id: varchar('id', { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: varchar('event_id', { length: 255 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantedBy: varchar('granted_by', { length: 255 })
      .notNull()
      .references(() => users.id),
    status: adminGrantStatusEnum('status').notNull().default('active'),
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
    eventUserUnique: uniqueIndex('event_admin_event_user_unique').on(
      table.eventId,
      table.userId,
    ),
    userIdIdx: index('event_admin_user_id_idx').on(table.userId),
  }),
);

export const eventAdminRelations = relations(eventAdmin, ({ one }) => ({
  event: one(events, {
    fields: [eventAdmin.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAdmin.userId],
    references: [users.id],
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
    eventId: varchar('event_id', { length: 255 }).references(() => events.id, {
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
    publishedAt: timestamp('published_at', {
      mode: 'date',
      withTimezone: true,
    }),
    createdBy: varchar('created_by', { length: 255 }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
    ...timestamps,
  },
  (table) => ({
    lembagaIdx: index('form_lembaga_id_idx').on(table.lembagaId),
    eventIdx: index('form_event_id_idx').on(table.eventId),
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
    archivedAt: timestamp('archived_at', { mode: 'date', withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    formOrderIdx: index('form_field_form_order_idx').on(
      table.formId,
      table.sortOrder,
    ),
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
    submittedAt: timestamp('submitted_at', { mode: 'date', withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
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
