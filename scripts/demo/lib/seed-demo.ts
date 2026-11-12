/**
 * Isi data demo untuk kelima peran (Anonim, Mahasiswa, Owner Lembaga,
 * Admin Lembaga/Kegiatan, Superadmin/Operator).
 *
 * Idempoten: akun di-upsert menurut email, sedangkan baris lain memakai id
 * tetap (`demo-…`) dengan `ON CONFLICT DO NOTHING`. Menjalankannya berulang
 * tidak menggandakan data dan tidak menimpa perubahan yang dibuat saat demo.
 *
 * Modul ini tidak memuat `~/env` ataupun koneksi sendiri; pemanggil memberi
 * `db`, sehingga tes dapat memakainya pada database uji.
 */
import { eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import * as schema from '~/server/db/schema';

export type DemoDb = PostgresJsDatabase<typeof schema>;

const {
  users,
  mahasiswa,
  lembaga,
  lembagaMembership,
  events,
  keanggotaan,
  organizationStructure,
  organizationUnit,
  organizationPosition,
  placement,
  form,
  formSection,
  formField,
  formFieldOption,
  formSubmission,
  formAnswer,
  recruitment,
  recruitmentWave,
  recruitmentDivision,
  application,
  applicationChoice,
  placementDecision,
  accessGrant,
  adminPermission,
  associationRequests,
  associationRequestsLembaga,
  support,
  notifications,
  bestStaffLembaga,
  riwayatKepanitiaan,
  riwayatOrganisasi,
} = schema;

type DemoAccount = {
  key: string;
  email: string;
  name: string;
  role: 'admin' | 'lembaga' | 'mahasiswa';
  mahasiswa?: { nim: number; jurusan: string; angkatan: number };
  lembaga?: {
    name: string;
    type: (typeof schema.lembagaTypeEnum.enumValues)[number];
    acronym?: string;
    description?: string;
  };
};

const DEMO_DOMAIN = 'demo.anmategra.local';

const mhsNames = [
  'Alya Pramesti',
  'Bagas Nugroho',
  'Citra Maharani',
  'Dimas Aditya',
  'Eka Wulandari',
  'Fajar Ramadhan',
  'Gita Savitri',
  'Hana Putri',
];
const mhsJurusan = [
  'Teknik Informatika',
  'Sistem dan Teknologi Informasi',
  'Teknik Elektro',
  'Teknik Industri',
];

/** Akun inti yang dipakai skenario per peran; dua email nyata dipertahankan. */
const coreAccounts: DemoAccount[] = [
  { key: 'admin', email: `demo.admin@${DEMO_DOMAIN}`, name: 'Demo Admin', role: 'admin' },
  {
    key: 'mahasiswa',
    email: `demo.mahasiswa@${DEMO_DOMAIN}`,
    name: 'Demo Mahasiswa',
    role: 'mahasiswa',
    mahasiswa: { nim: 13523001, jurusan: 'Teknik Informatika', angkatan: 2023 },
  },
  {
    key: 'owner',
    email: `demo.lembaga@${DEMO_DOMAIN}`,
    name: 'Demo Himpunan',
    role: 'lembaga',
    lembaga: {
      name: 'Himpunan Demo',
      type: 'Himpunan',
      acronym: 'HMD',
      description:
        'Himpunan fiktif untuk demo Anmategra: contoh lembaga dengan kepengurusan, kegiatan, organogram, dan open recruitment.',
    },
  },
  {
    key: 'real-mhs',
    email: '13523094@mahasiswa.itb.ac.id',
    name: 'Admin Mahasiswa',
    role: 'mahasiswa',
    mahasiswa: { nim: 13523094, jurusan: 'Teknik Informatika', angkatan: 2023 },
  },
  {
    key: 'real-lembaga',
    email: 'anmategra@km.itb.ac.id',
    name: 'Admin Anmategra',
    role: 'lembaga',
    lembaga: { name: 'Anmategra', type: 'Kepanitiaan', acronym: 'ANM' },
  },
  {
    key: 'admin-lembaga',
    email: `demo.admin-lembaga@${DEMO_DOMAIN}`,
    name: 'Demo Admin Lembaga',
    role: 'mahasiswa',
    mahasiswa: { nim: 13522201, jurusan: 'Teknik Informatika', angkatan: 2022 },
  },
  {
    key: 'admin-kegiatan',
    email: `demo.admin-kegiatan@${DEMO_DOMAIN}`,
    name: 'Demo Admin Kegiatan',
    role: 'mahasiswa',
    mahasiswa: { nim: 13522202, jurusan: 'Teknik Elektro', angkatan: 2022 },
  },
  {
    key: 'operator',
    email: `demo.operator@${DEMO_DOMAIN}`,
    name: 'Demo Operator',
    role: 'mahasiswa',
    mahasiswa: { nim: 13522203, jurusan: 'Teknik Industri', angkatan: 2022 },
  },
];

const memberAccounts: DemoAccount[] = mhsNames.map((name, i) => ({
  key: `m${i + 1}`,
  email: `demo.mhs${i + 1}@${DEMO_DOMAIN}`,
  name,
  role: 'mahasiswa',
  mahasiswa: {
    nim: 13523100 + i + 1,
    jurusan: mhsJurusan[i % mhsJurusan.length]!,
    angkatan: i < 4 ? 2023 : 2024,
  },
}));

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  ...coreAccounts,
  ...memberAccounts,
];

const at = (iso: string) => new Date(iso);

// Id tetap supaya seed idempoten.
const ID = {
  lembagaMembership: (i: number) => `demo-lm-${i}`,
  kepengurusan: 'demo-period-kepengurusan',
  fest: 'demo-event-fest-2026',
  festLama: 'demo-event-fest-2025',
  oprecEvent: 'demo-event-oprec-2026',
};

type UnitSpec = { key: string; name: string; kind: 'Bidang'; positions: PositionSpec[] };
type PositionSpec = {
  key: string;
  title: string;
  rank: string;
  kind: 'struktural' | 'nonstruktural';
  quota: number;
};

const ORGANOGRAM: UnitSpec[] = [
  {
    key: 'inti',
    name: 'Inti',
    kind: 'Bidang',
    positions: [
      { key: 'ketua', title: 'Ketua', rank: 'head', kind: 'struktural', quota: 1 },
      { key: 'wakil', title: 'Wakil Ketua', rank: 'vice', kind: 'struktural', quota: 1 },
    ],
  },
  ...[
    ['acara', 'Acara', 4],
    ['humas', 'Humas', 3],
    ['perlengkapan', 'Perlengkapan', 3],
  ].map(
    ([key, name, staf]): UnitSpec => ({
      key: key as string,
      name: name as string,
      kind: 'Bidang',
      positions: [
        {
          key: 'koord',
          title: `Koordinator ${name as string}`,
          rank: 'coordinator',
          kind: 'struktural',
          quota: 1,
        },
        {
          key: 'staf',
          title: `Staf ${name as string}`,
          rank: 'staff',
          kind: 'nonstruktural',
          quota: staf as number,
        },
      ],
    }),
  ),
];

const unitId = (eventId: string, unitKey: string) => `${eventId}-unit-${unitKey}`;
const positionId = (eventId: string, unitKey: string, posKey: string) =>
  `${eventId}-pos-${unitKey}-${posKey}`;

async function seedAccounts(db: DemoDb) {
  const userIds = new Map<string, string>();
  for (const account of DEMO_ACCOUNTS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, account.email),
    });
    const [user] = existing
      ? await db
          .update(users)
          .set({
            name: account.name,
            role: account.role,
            isDemo: true,
            emailVerified: new Date(),
          })
          .where(eq(users.id, existing.id))
          .returning({ id: users.id })
      : await db
          .insert(users)
          .values({
            email: account.email,
            name: account.name,
            role: account.role,
            isDemo: true,
            emailVerified: new Date(),
          })
          .returning({ id: users.id });
    if (!user) throw new Error(`Gagal membuat ${account.email}`);
    userIds.set(account.key, user.id);

    if (account.mahasiswa) {
      await db
        .insert(mahasiswa)
        .values({
          userId: user.id,
          nim: account.mahasiswa.nim,
          nama: account.name,
          jurusan: account.mahasiswa.jurusan,
          angkatan: account.mahasiswa.angkatan,
          status: 'aktif',
        })
        .onConflictDoNothing();
    }

    if (account.lembaga) {
      const row = await db.query.lembaga.findFirst({
        where: eq(lembaga.userId, user.id),
      });
      if (!row) {
        await db.insert(lembaga).values({
          userId: user.id,
          name: account.lembaga.name,
          type: account.lembaga.type,
          acronym: account.lembaga.acronym ?? null,
          description: account.lembaga.description ?? null,
          foundingDate: new Date(),
        });
      }
    }
  }
  return userIds;
}

async function seedOrganogram(
  db: DemoDb,
  eventId: string,
  name: string,
) {
  const structureId = `${eventId}-struct`;
  await db
    .insert(organizationStructure)
    .values({ id: structureId, eventId, name, is_active: true })
    .onConflictDoNothing();
  let order = 0;
  for (const unit of ORGANOGRAM) {
    await db
      .insert(organizationUnit)
      .values({
        id: unitId(eventId, unit.key),
        structure_id: structureId,
        name: unit.name,
        kind: unit.kind,
        level: 1,
        sort_order: order++,
      })
      .onConflictDoNothing();
    let posOrder = 0;
    for (const pos of unit.positions) {
      await db
        .insert(organizationPosition)
        .values({
          id: positionId(eventId, unit.key, pos.key),
          unitId: unitId(eventId, unit.key),
          title: pos.title,
          rank: pos.rank,
          kind: pos.kind,
          quota: pos.quota,
          sort_order: posOrder++,
        })
        .onConflictDoNothing();
    }
  }
}

/** Form pendaftaran: satu bagian, dua isian teks dan satu pilihan. */
async function seedForm(
  db: DemoDb,
  id: string,
  opts: {
    title: string;
    status: 'Draft' | 'Published' | 'Closed';
    eventId: string;
    createdBy: string;
    publishedAt?: Date;
    closesAt?: Date;
  },
) {
  await db
    .insert(form)
    .values({
      id,
      eventId: opts.eventId,
      title: opts.title,
      description: 'Formulir demo; isian contoh untuk alur open recruitment.',
      status: opts.status,
      publishedAt: opts.publishedAt ?? null,
      closesAt: opts.closesAt ?? null,
      createdBy: opts.createdBy,
    })
    .onConflictDoNothing();
  await db
    .insert(formSection)
    .values({ id: `${id}-sec`, formId: id, title: 'Data diri', sortOrder: 0 })
    .onConflictDoNothing();
  await db
    .insert(formField)
    .values([
      {
        id: `${id}-f-nama`,
        formId: id,
        sectionId: `${id}-sec`,
        type: 'short_text',
        label: 'Nama lengkap',
        required: true,
        sortOrder: 0,
      },
      {
        id: `${id}-f-motivasi`,
        formId: id,
        sectionId: `${id}-sec`,
        type: 'long_text',
        label: 'Mengapa kamu ingin bergabung?',
        required: true,
        sortOrder: 1,
      },
      {
        id: `${id}-f-angkatan`,
        formId: id,
        sectionId: `${id}-sec`,
        type: 'single_choice',
        label: 'Angkatan',
        required: false,
        sortOrder: 2,
      },
    ])
    .onConflictDoNothing();
  await db
    .insert(formFieldOption)
    .values(
      ['2022', '2023', '2024'].map((label, i) => ({
        id: `${id}-f-angkatan-o${i}`,
        fieldId: `${id}-f-angkatan`,
        label,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
}

async function seedSubmission(
  db: DemoDb,
  formId: string,
  userId: string,
  name: string,
  submittedAt: Date,
) {
  const id = `${formId}-sub-${userId}`;
  await db
    .insert(formSubmission)
    .values({ id, formId, userId, submittedAt, updatedAt: submittedAt })
    .onConflictDoNothing();
  await db
    .insert(formAnswer)
    .values([
      {
        id: `${id}-a-nama`,
        submissionId: id,
        fieldId: `${formId}-f-nama`,
        fieldLabel: 'Nama lengkap',
        fieldType: 'short_text',
        value: name,
      },
      {
        id: `${id}-a-motivasi`,
        submissionId: id,
        fieldId: `${formId}-f-motivasi`,
        fieldLabel: 'Mengapa kamu ingin bergabung?',
        fieldType: 'long_text',
        value: 'Ingin belajar berorganisasi dan berkontribusi bagi kampus.',
      },
    ])
    .onConflictDoNothing();
  return id;
}

async function seedRecruitment(
  db: DemoDb,
  rec: {
    id: string;
    periodId: string;
    formId: string;
    name: string;
    status: 'draft' | 'open' | 'closed';
    final?: boolean;
    divisions: boolean;
  },
) {
  await db
    .insert(recruitment)
    .values({
      id: rec.id,
      periodId: rec.periodId,
      formId: rec.formId,
      name: rec.name,
      status: rec.status,
      placementState: rec.final ? 'final' : 'berjalan',
      resultsReleasedAt: rec.final ? at('2026-03-20T00:00:00Z') : null,
      resultsVisibleToApplicants: rec.final === true,
      setupCompletedAt: rec.status === 'draft' ? null : at('2026-02-01T00:00:00Z'),
    })
    .onConflictDoNothing();
  if (rec.status !== 'draft') {
    await db
      .insert(recruitmentWave)
      .values({
        id: `${rec.id}-wave1`,
        recruitmentId: rec.id,
        label: 'Gelombang 1',
        startsAt: at(rec.final ? '2026-02-01T00:00:00Z' : '2026-10-01T00:00:00Z'),
        endsAt: at(rec.final ? '2026-02-28T00:00:00Z' : '2026-12-31T00:00:00Z'),
      })
      .onConflictDoNothing();
  }
  if (rec.divisions) {
    let order = 0;
    for (const unit of ORGANOGRAM.filter((u) => u.key !== 'inti')) {
      await db
        .insert(recruitmentDivision)
        .values({
          id: `${rec.id}-div-${unit.key}`,
          recruitmentId: rec.id,
          unitId: unitId(rec.periodId, unit.key),
          positionId: positionId(rec.periodId, unit.key, 'staf'),
          code: unit.name.slice(0, 3).toUpperCase(),
          sortOrder: order++,
        })
        .onConflictDoNothing();
    }
  }
}

async function seedApplication(
  db: DemoDb,
  a: {
    recId: string;
    formId: string;
    userId: string;
    name: string;
    unitKey: string;
    decision?: { by: string; value: 'terima' | 'tolak' };
    submitted: boolean;
  },
) {
  const submittedAt = at('2026-02-10T00:00:00Z');
  const submissionId = a.submitted
    ? await seedSubmission(db, a.formId, a.userId, a.name, submittedAt)
    : null;
  const appId = `${a.recId}-app-${a.userId}`;
  await db
    .insert(application)
    .values({
      id: appId,
      recruitmentId: a.recId,
      userId: a.userId,
      waveId: `${a.recId}-wave1`,
      formSubmissionId: submissionId,
      source: 'form',
      submittedAt: a.submitted ? submittedAt : null,
    })
    .onConflictDoNothing();
  const choiceId = `${appId}-c1`;
  await db
    .insert(applicationChoice)
    .values({
      id: choiceId,
      applicationId: appId,
      divisionId: `${a.recId}-div-${a.unitKey}`,
      rank: 1,
      origin: 'dipilih',
      score: a.decision ? (a.decision.value === 'terima' ? '82' : '48') : null,
      computedStatus: a.decision
        ? a.decision.value === 'terima'
          ? 'lolos'
          : 'tidak_lolos'
        : a.submitted
          ? 'perlu_ditinjau'
          : 'belum_lengkap',
    })
    .onConflictDoNothing();
  if (a.decision) {
    await db
      .insert(placementDecision)
      .values({
        id: `${choiceId}-dec`,
        choiceId,
        decision: a.decision.value,
        decidedBy: a.decision.by,
        decidedAt: at('2026-03-15T00:00:00Z'),
      })
      .onConflictDoNothing();
  }
  return choiceId;
}

/** Mengisi seluruh data demo; aman dipanggil berulang. */
export async function seedDemo(db: DemoDb) {
  const u = await seedAccounts(db);
  const id = (key: string) => {
    const v = u.get(key);
    if (!v) throw new Error(`Akun demo tidak ditemukan: ${key}`);
    return v;
  };
  const owner = id('owner');
  const hmd = await db.query.lembaga.findFirst({
    where: eq(lembaga.userId, owner),
    columns: { id: true },
  });
  if (!hmd) throw new Error('Lembaga Himpunan Demo tidak ditemukan');
  const lembagaId = hmd.id;

  // Keanggotaan lembaga (Owner, Admin, dan enam mahasiswa).
  const memberKeys = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'admin-lembaga', 'admin-kegiatan'];
  await db
    .insert(lembagaMembership)
    .values(
      memberKeys.map((k, i) => ({
        id: ID.lembagaMembership(i + 1),
        lembagaId,
        userId: id(k),
        cohortYear: 2023,
        cohortLabel: 'Angkatan 2023',
        status: 'aktif' as const,
        source: 'manual' as const,
        joinedAt: at('2025-08-01T00:00:00Z'),
      })),
    )
    .onConflictDoNothing();

  // Periode, kegiatan terdahulu, kegiatan berjalan, dan kegiatan oprec.
  const eventBase = { org_id: lembagaId } as const;
  await db
    .insert(events)
    .values([
      {
        ...eventBase,
        id: ID.kepengurusan,
        kind: 'kepengurusan',
        label: '2025/2026',
        name: 'Kepengurusan HMD 2025/2026',
        description: 'Periode kepengurusan aktif Himpunan Demo.',
        start_date: at('2025-08-01T00:00:00Z'),
        end_date: at('2026-07-31T00:00:00Z'),
        status: 'On going',
      },
      {
        ...eventBase,
        id: ID.festLama,
        name: 'Demo Fest 2025',
        description: 'Edisi sebelumnya; sumber riwayat kepanitiaan.',
        start_date: at('2025-03-01T00:00:00Z'),
        end_date: at('2025-03-03T00:00:00Z'),
        status: 'Ended',
        location: 'Aula Barat ITB',
      },
      {
        ...eventBase,
        id: ID.fest,
        name: 'Demo Fest 2026',
        description:
          'Festival tahunan Himpunan Demo dengan panitia terstruktur dan oprec yang sudah selesai.',
        start_date: at('2026-04-10T00:00:00Z'),
        end_date: at('2026-04-12T00:00:00Z'),
        status: 'On going',
        location: 'Aula Barat ITB',
        participant_limit: 300,
        is_highlighted: true,
        is_organogram: true,
      },
      {
        ...eventBase,
        id: ID.oprecEvent,
        name: 'Open Recruitment Staf HMD 2026/2027',
        description: 'Pendaftaran staf baru; oprec sedang terbuka.',
        start_date: at('2026-10-01T00:00:00Z'),
        end_date: at('2026-12-31T00:00:00Z'),
        status: 'Coming Soon',
        is_organogram: true,
      },
    ])
    .onConflictDoNothing();

  await seedOrganogram(db, ID.fest, 'Panitia Demo Fest 2026');
  await seedOrganogram(db, ID.oprecEvent, 'Staf HMD 2026/2027');

  // Penempatan panitia Demo Fest 2026 (manual) + keanggotaan lama yang masih dibaca UI.
  const manual: [string, string, string, string][] = [
    ['m1', 'inti', 'ketua', 'Ketua'],
    ['m2', 'inti', 'wakil', 'Wakil Ketua'],
    ['m3', 'acara', 'koord', 'Koordinator Acara'],
    ['m6', 'humas', 'koord', 'Koordinator Humas'],
    ['m7', 'perlengkapan', 'koord', 'Koordinator Perlengkapan'],
  ];
  const oprecPlaced: [string, string][] = [
    ['mahasiswa', 'acara'],
    ['m4', 'acara'],
    ['m5', 'humas'],
  ];

  // Oprec 1: selesai (Demo Fest 2026) — form tertutup, hasil dirilis.
  const festForm = 'demo-form-fest';
  await seedForm(db, festForm, {
    title: 'Pendaftaran Panitia Demo Fest 2026',
    status: 'Closed',
    eventId: ID.fest,
    createdBy: owner,
    publishedAt: at('2026-02-01T00:00:00Z'),
    closesAt: at('2026-02-28T00:00:00Z'),
  });
  const festRec = 'demo-rec-fest';
  await seedRecruitment(db, {
    id: festRec,
    periodId: ID.fest,
    formId: festForm,
    name: 'Oprec Panitia Demo Fest 2026',
    status: 'closed',
    final: true,
    divisions: true,
  });
  const choiceByUser = new Map<string, string>();
  const festApplicants: [string, string, string, 'terima' | 'tolak'][] = [
    ['mahasiswa', 'Demo Mahasiswa', 'acara', 'terima'],
    ['m4', mhsNames[3]!, 'acara', 'terima'],
    ['m5', mhsNames[4]!, 'humas', 'terima'],
    ['m8', mhsNames[7]!, 'perlengkapan', 'tolak'],
  ];
  for (const [key, name, unitKey, value] of festApplicants) {
    choiceByUser.set(
      key,
      await seedApplication(db, {
        recId: festRec,
        formId: festForm,
        userId: id(key),
        name,
        unitKey,
        decision: { by: owner, value },
        submitted: true,
      }),
    );
  }

  const placements = [
    ...manual.map(([k, unit, pos]) => ({
      id: `demo-pl-${k}`,
      positionId: positionId(ID.fest, unit, pos),
      userId: id(k),
      source: 'manual' as const,
      applicationChoiceId: null as string | null,
    })),
    ...oprecPlaced.map(([k, unit]) => ({
      id: `demo-pl-${k}`,
      positionId: positionId(ID.fest, unit, 'staf'),
      userId: id(k),
      source: 'oprec' as const,
      applicationChoiceId: choiceByUser.get(k) ?? null,
    })),
  ];
  await db
    .insert(placement)
    .values(placements.map((p) => ({ ...p, createdBy: owner })))
    .onConflictDoNothing();

  const unitOf = new Map<string, { unit: string; pos: string; title: string }>();
  for (const [k, unit, pos, title] of manual) unitOf.set(k, { unit, pos, title });
  for (const [k, unit] of oprecPlaced) {
    const name = ORGANOGRAM.find((o) => o.key === unit)!.name;
    unitOf.set(k, { unit, pos: 'staf', title: `Staf ${name}` });
  }
  let idx = 0;
  await db
    .insert(keanggotaan)
    .values(
      [...unitOf.entries()].map(([k, v]) => ({
        id: `demo-kg-${k}`,
        event_id: ID.fest,
        user_id: id(k),
        org_unit_id: unitId(ID.fest, v.unit),
        position: v.title,
        division: ORGANOGRAM.find((o) => o.key === v.unit)!.name,
        index: idx++,
      })),
    )
    .onConflictDoNothing();

  // Oprec 2: terbuka (Open Recruitment Staf HMD) — menunggu pendaftar baru.
  const openForm = 'demo-form-oprec';
  await seedForm(db, openForm, {
    title: 'Pendaftaran Staf HMD 2026/2027',
    status: 'Published',
    eventId: ID.oprecEvent,
    createdBy: owner,
    publishedAt: at('2026-10-01T00:00:00Z'),
    closesAt: at('2026-12-31T00:00:00Z'),
  });
  const openRec = 'demo-rec-open';
  await seedRecruitment(db, {
    id: openRec,
    periodId: ID.oprecEvent,
    formId: openForm,
    name: 'Oprec Staf HMD 2026/2027',
    status: 'open',
    divisions: true,
  });
  await seedApplication(db, {
    recId: openRec,
    formId: openForm,
    userId: id('m7'),
    name: mhsNames[6]!,
    unitKey: 'humas',
    submitted: true,
  });
  await seedApplication(db, {
    recId: openRec,
    formId: openForm,
    userId: id('m8'),
    name: mhsNames[7]!,
    unitKey: 'acara',
    submitted: false,
  });

  // Oprec 3: draf pada periode kepengurusan (belum ada divisi).
  const draftForm = 'demo-form-draft';
  await seedForm(db, draftForm, {
    title: 'Pendaftaran Pengurus HMD 2026/2027 (draf)',
    status: 'Draft',
    eventId: ID.kepengurusan,
    createdBy: owner,
  });
  await seedRecruitment(db, {
    id: 'demo-rec-draft',
    periodId: ID.kepengurusan,
    formId: draftForm,
    name: 'Oprec Pengurus HMD 2026/2027',
    status: 'draft',
    divisions: false,
  });

  // Hibah akses: Admin Lembaga (lingkup lembaga) dan Admin Kegiatan (lingkup kegiatan).
  await db
    .insert(accessGrant)
    .values([
      {
        id: 'demo-grant-lembaga',
        userId: id('admin-lembaga'),
        lembagaId,
        features: ['admin'],
        propagate: true,
        grantedBy: owner,
      },
      {
        id: 'demo-grant-kegiatan',
        userId: id('admin-kegiatan'),
        periodId: ID.fest,
        features: ['oprec', 'forms', 'organization'],
        grantedBy: owner,
      },
    ])
    .onConflictDoNothing();

  // Operator dengan izin terbatas (baca akun, lembaga, audit, laporan).
  await db
    .insert(adminPermission)
    .values({
      id: 'demo-operator-perm',
      userId: id('operator'),
      permissions: ['accounts.read', 'lembaga.read', 'audit.read', 'reports.read', 'reports.write'],
      grantedBy: id('admin'),
    })
    .onConflictDoNothing();

  // Permintaan asosiasi menunggu persetujuan.
  await db
    .insert(associationRequestsLembaga)
    .values({
      id: 'demo-assoc-lembaga',
      lembagaId,
      user_id: id('m8'),
      position: 'Staf',
      division: 'Acara',
      status: 'Pending',
    })
    .onConflictDoNothing();
  await db
    .insert(associationRequests)
    .values({
      id: 'demo-assoc-event',
      event_id: ID.fest,
      user_id: id('m7'),
      position: 'Staf Humas',
      division: 'Humas',
      status: 'Pending',
    })
    .onConflictDoNothing();

  // Laporan dengan tiga status berbeda.
  await db
    .insert(support)
    .values([
      {
        id: 'demo-support-1',
        user_id: id('mahasiswa'),
        subject: 'Foto profil tidak tampil',
        description: 'Setelah mengunggah foto, profil tetap menampilkan gambar bawaan.',
        urgent: 'Low',
        status: 'Open',
      },
      {
        id: 'demo-support-2',
        user_id: id('m1'),
        subject: 'Organogram tidak dapat disimpan',
        description: 'Tombol simpan pada organogram tidak merespons.',
        urgent: 'High',
        status: 'In Progress',
      },
      {
        id: 'demo-support-3',
        user_id: id('m2'),
        subject: 'Salah NIM pada profil',
        description: 'NIM di profil tertukar; mohon dikoreksi.',
        urgent: 'Medium',
        status: 'Resolved',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(notifications)
    .values({
      id: 'demo-notif-1',
      user_id: owner,
      title: 'Permintaan asosiasi baru',
      content: `${mhsNames[7]!} meminta bergabung ke Himpunan Demo.`,
      type: 'Association Request',
    })
    .onConflictDoNothing();

  // Riwayat dan Best Staff agar halaman rapor/histori tidak kosong.
  await db
    .insert(riwayatKepanitiaan)
    .values(
      ['m1', 'm3'].map((k, i) => ({
        id: `demo-rk-${k}`,
        userId: id(k),
        eventId: ID.festLama,
        eventNama: 'Demo Fest 2025',
        lembagaId,
        lembagaNama: 'Himpunan Demo',
        division: i === 0 ? 'Acara' : 'Humas',
        position: 'Staf',
        startedAt: at('2025-01-15T00:00:00Z'),
        endedAt: at('2025-03-05T00:00:00Z'),
        endReason: 'left' as const,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(riwayatOrganisasi)
    .values({
      id: 'demo-ro-m2',
      userId: id('m2'),
      lembagaId,
      lembagaNama: 'Himpunan Demo',
      lembagaTipe: 'Himpunan',
      division: 'Acara',
      position: 'Staf',
      startedAt: at('2024-08-01T00:00:00Z'),
      endedAt: at('2025-07-31T00:00:00Z'),
      endReason: 'left',
    })
    .onConflictDoNothing();
  await db
    .insert(bestStaffLembaga)
    .values({
      id: 'demo-bs-m3',
      lembagaId,
      mahasiswaId: id('m3'),
      division: 'Acara',
      startDate: at('2025-08-01T00:00:00Z'),
      endDate: at('2026-01-31T00:00:00Z'),
    })
    .onConflictDoNothing();

  return { accounts: DEMO_ACCOUNTS.map((a) => a.email) };
}
