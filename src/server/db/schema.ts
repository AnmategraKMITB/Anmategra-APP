import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
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
  ...timestamps,
});

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
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
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
}));

export const eventStatusEnum = pgEnum('event_status', [
  'Coming Soon',
  'On going',
  'Ended',
]);

export const events = createTable('event', {
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
});

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
    org_unit_id: varchar('org_unit_id', { length: 255 }),
    org_role_id: varchar('org_role_id', { length: 255 }),
    position: varchar('position', { length: 255 }).notNull(),
    division: varchar('division', { length: 255 }).notNull(),
    index: integer('index').notNull().default(0),
    description: text('description'),
  },
  (table) => ({
    uniqueEventUser: uniqueIndex('keanggotaan_event_user_unique').on(
      table.event_id,
      table.user_id,
    ),
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
  org_unit_id: varchar('org_unit_id', { length: 255 }),
  org_role_id: varchar('org_role_id', { length: 255 }),
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
    org_unit_id: varchar('org_unit_id', { length: 255 }),
    org_role_id: varchar('org_role_id', { length: 255 }),
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
    org_unit_id: varchar('org_unit_id', { length: 255 }),
    org_role_id: varchar('org_role_id', { length: 255 }),
    division: varchar('division', { length: 255 }).notNull(),
    position: varchar('position', { length: 255 }).notNull(),
    index: integer('index').notNull().default(0),
  },
  (table) => ({
    uniqueEventUser: uniqueIndex('kehimpunan_lembaga_user_unique').on(
      table.lembagaId,
      table.userId,
    ),
  }),
);

// Organization Structure
export const organizationStructure = createTable('organization_structure', {
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
});

// Organization Unit
export const organizationUnit = createTable('organization_unit', {
  id: varchar('id', { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  structure_id: varchar('structure_id', { length: 255 })
    .references(() => organizationStructure.id, { onDelete: 'cascade' })
    .notNull(),
  parent_id: varchar('parent_id', { length: 255 }).references(
    () => organizationUnit.id,
    { onDelete: 'restrict' },
  ),
  name: varchar('name', { length: 255 }).notNull(),
  kind: varchar('kind', { length: 255 }).notNull(),
  level: integer('level').notNull(),
  sort_order: integer('sort_order').notNull().default(0),
  ...timestamps,
});

// Organization Role
export const organizationRole = createTable('organization_role', {
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
});

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

export const pemetaanProfilKegiatan = createTable('pemetaan_profil_kegiatan', {
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
});

export const pemetaanProfilLembaga = createTable('pemetaan_profil_lembaga', {
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
});

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
