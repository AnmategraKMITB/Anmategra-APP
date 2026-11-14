/**
 * Mock oprec besar untuk mencoba alur Nilai dan Penempatan di database dev.
 * JANGAN dijalankan ke database production.
 *
 *   DATABASE_URL=... npm run seed:oprec-mock
 *
 * Tiap kali dijalankan membuat lembaga, periode, organogram, dan oprec baru
 * (tidak menghapus data lama). Akun-akunnya ber-email `@mock.oprec.test`,
 * jadi bisa dipakai dengan `docker/local/dev-login.mjs <role> <email>`.
 * Ringkasan akun dan id dicetak di akhir.
 */
import { eq, inArray, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { it } from 'vitest';
import { oprecRouter } from '~/server/api/routers/oprec';
import { createApplicationFromSubmission } from '~/server/api/routers/oprec/application';
import { recomputeDivisions } from '~/server/api/routers/oprec/recompute';
import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import * as schema from '~/server/db/schema';

const APPLICANTS = Number(process.env.MOCK_APPLICANTS ?? 150);
const DOMAIN = 'mock.oprec.test';

// Acak yang bisa diulang: hasil sama untuk MOCK_SEED yang sama.
let seed = Number(process.env.MOCK_SEED ?? 20261114);
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const chance = (p: number) => rand() < p;
const clampRating = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
const normal = () => {
  const u = rand() || 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
};

const DIVISIONS = [
  { name: 'Acara', quota: 8, popularity: 5 },
  { name: 'Humas', quota: 5, popularity: 4 },
  { name: 'Logistik', quota: 10, popularity: 2 },
  { name: 'Konsumsi', quota: 6, popularity: 2 },
  { name: 'Medis', quota: 4, popularity: 1 },
  // Kuota 0 = tanpa batas.
  { name: 'Dokumentasi', quota: 0, popularity: 3 },
] as const;

const FIRST = [
  'Adinda',
  'Bagas',
  'Citra',
  'Dimas',
  'Elsa',
  'Fajar',
  'Gita',
  'Hafiz',
  'Intan',
  'Jovan',
  'Kirana',
  'Luthfi',
  'Maya',
  'Naufal',
  'Olivia',
  'Putra',
  'Qonita',
  'Raka',
  'Salsa',
  'Teguh',
  'Ulya',
  'Vino',
  'Wulan',
  'Yusuf',
  'Zahra',
  'Aulia',
  'Bima',
  'Dewi',
  'Farhan',
  'Nadia',
];
const LAST = [
  'Pratama',
  'Saputri',
  'Nugroho',
  'Wijaya',
  'Lestari',
  'Hidayat',
  'Siregar',
  'Halim',
  'Putri',
  'Ramadhan',
  'Kusuma',
  'Simanjuntak',
  'Anggraini',
  'Firmansyah',
  'Tanjung',
  'Maharani',
];
const PRODI = [
  { code: 135, name: 'Teknik Informatika' },
  { code: 182, name: 'Sistem dan Teknologi Informasi' },
  { code: 132, name: 'Teknik Elektro' },
  { code: 131, name: 'Teknik Mesin' },
  { code: 165, name: 'Teknik Fisika' },
  { code: 197, name: 'Manajemen' },
  { code: 170, name: 'Desain Komunikasi Visual' },
  { code: 104, name: 'Kimia' },
] as const;

const OPENERS = [
  'Saya ingin belajar bekerja dalam tim besar dan merasakan langsung bagaimana acara sebesar ini disiapkan.',
  'Tahun lalu saya menjadi peserta dan merasa sangat terbantu oleh panitia, jadi sekarang saya ingin ikut memberi kembali.',
  'Saya mencari kegiatan di luar akademik yang bisa melatih komunikasi dan manajemen waktu saya.',
  'Jujur saya belum punya banyak pengalaman kepanitiaan, tetapi saya siap belajar dari awal.',
  'Saya sudah beberapa kali ikut kepanitiaan di himpunan dan ingin mencoba skala yang lebih besar.',
];
const MIDDLES = [
  'Di SMA saya pernah menjadi ketua OSIS bidang acara dan mengurus pentas seni dengan 600 penonton.',
  'Semester lalu saya menjadi staf di kepanitiaan wisuda himpunan, mengurus perizinan ruangan dan vendor.',
  'Saya terbiasa membuat konten media sosial untuk UKM saya, termasuk desain dan penulisan caption.',
  'Saya aktif di organisasi daerah dan sering membantu mengoordinasikan kegiatan bakti sosial.',
  'Saya belum pernah ikut kepanitiaan, tetapi saya sering membantu acara keluarga dan komunitas di rumah.',
  'Saya pernah magang singkat di event organizer sehingga paham alur persiapan sampai hari-H.',
];
const CLOSERS = [
  'Saya bisa menyediakan waktu sekitar 10 jam per minggu dan siap hadir di rapat rutin.',
  'Jadwal kuliah saya cukup padat di hari Selasa dan Kamis, tetapi di luar itu saya fleksibel.',
  'Saya berkomitmen hadir penuh saat hari-H dan gladi.',
  'Saya juga sedang mengikuti satu UKM, tetapi sudah saya atur supaya tidak bentrok.',
];
const FIT: Record<string, string[]> = {
  Acara: [
    'Saya suka menyusun rundown dan memikirkan pengalaman peserta dari menit ke menit.',
    'Saya ingin belajar menjadi MC dan mengatur alur acara.',
  ],
  Humas: [
    'Saya senang berkomunikasi dengan pihak luar dan pernah mencari sponsor untuk acara jurusan.',
    'Saya terbiasa menulis rilis dan mengelola akun media sosial.',
  ],
  Logistik: [
    'Saya teliti soal inventaris dan pernah mengurus peminjaman barang untuk acara besar.',
    'Saya kuat secara fisik dan tidak keberatan mengangkut barang.',
  ],
  Konsumsi: [
    'Saya pernah mengurus konsumsi untuk 200 orang dan paham cara bernegosiasi dengan katering.',
    'Saya memperhatikan detail seperti alergi dan pilihan makanan vegetarian.',
  ],
  Medis: [
    'Saya pernah ikut pelatihan P3K dan menjadi anggota PMR saat SMA.',
    'Saya tenang menghadapi situasi darurat.',
  ],
  Dokumentasi: [
    'Saya punya kamera sendiri dan terbiasa memotret acara.',
    'Saya bisa menyunting video singkat untuk rekap acara.',
  ],
};
const NOTES = [
  'Jawaban cukup spesifik, pengalaman relevan.',
  'Motivasi kurang jelas, perlu digali saat wawancara.',
  'Sangat antusias, tetapi komitmen waktunya meragukan.',
  'Portofolio rapi.',
  'Tautan CV tidak bisa dibuka, minta kirim ulang.',
  'Cocok juga untuk divisi lain.',
];

// Nama unik dalam satu kali seed; sebagian memakai nama tengah.
const usedNames = new Set<string>();
const personName = (): string => {
  for (;;) {
    const name: string = chance(0.4)
      ? `${pick(FIRST)} ${pick(FIRST)} ${pick(LAST)}`
      : `${pick(FIRST)} ${pick(LAST)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
};

const answerText = (division?: string) => {
  const parts = [pick(OPENERS), pick(MIDDLES)];
  if (division) parts.unshift(pick(FIT[division]!));
  if (chance(0.5)) parts.push(pick(CLOSERS));
  // Sebagian pendaftar menulis panjang, sebagian sangat singkat.
  if (chance(0.2))
    return parts.join(' ') + '\n\n' + [pick(MIDDLES), pick(CLOSERS)].join(' ');
  if (chance(0.15)) return parts[0]!;
  return parts.join(' ');
};
const driveLink = () =>
  `https://drive.google.com/file/d/${Math.floor(rand() * 1e16).toString(36)}${Math.floor(rand() * 1e16).toString(36)}/view`;

it('seed mock oprec', async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diisi.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Tidak boleh dijalankan di production.');
  }
  const client = postgres(url, { max: 1, onnotice: () => undefined });
  const db = drizzle(client, { schema });
  const run = Date.now().toString(36).slice(-4);
  const mail = (local: string) => `${local}-${run}@${DOMAIN}`;

  // Akun dan profil mahasiswa ------------------------------------------
  const usedNims = new Set(
    (await db.select({ nim: schema.mahasiswa.nim }).from(schema.mahasiswa)).map(
      (m) => m.nim,
    ),
  );
  const nextNim = (code: number, angkatan: number) => {
    for (;;) {
      const nim =
        code * 100000 + (angkatan % 100) * 1000 + Math.floor(rand() * 1000);
      if (!usedNims.has(nim)) {
        usedNims.add(nim);
        return nim;
      }
    }
  };
  const createStudent = async (
    local: string,
    name: string,
    angkatan = pick([2023, 2024, 2024, 2025]),
  ) => {
    const [user] = await db
      .insert(schema.users)
      .values({ email: mail(local), name, role: 'mahasiswa' })
      .returning();
    const prodi = pick(PRODI);
    await db.insert(schema.mahasiswa).values({
      userId: user!.id,
      nim: nextNim(prodi.code, angkatan),
      nama: name,
      jurusan: prodi.name,
      angkatan,
      lineId: `line.${local}`,
      whatsapp: `08${Math.floor(1e9 + rand() * 9e9)}`,
    });
    return user!;
  };

  // Lembaga, periode, organogram ---------------------------------------
  const [owner] = await db
    .insert(schema.users)
    .values({
      email: mail('pengelola'),
      name: 'Pengelola Oprec Mock',
      role: 'lembaga',
    })
    .returning();
  const [lembaga] = await db
    .insert(schema.lembaga)
    .values({ userId: owner!.id, name: `Kabinet Mock ${run}` })
    .returning();
  const [event] = await db
    .insert(schema.events)
    .values({
      id: crypto.randomUUID(),
      org_id: lembaga!.id,
      name: `Kepanitiaan Mock ${run}`,
      start_date: new Date('2026-10-01T00:00:00Z'),
      status: 'On going',
    })
    .returning();
  const [structure] = await db
    .insert(schema.organizationStructure)
    .values({
      eventId: event!.id,
      name: 'Struktur Kepanitiaan',
      is_active: true,
    })
    .returning();

  const addUnit = async (name: string, sort: number, quota: number) => {
    const [unit] = await db
      .insert(schema.organizationUnit)
      .values({ structure_id: structure!.id, name, level: 1, sort_order: sort })
      .returning();
    const [head, staff] = await db
      .insert(schema.organizationPosition)
      .values([
        {
          unitId: unit!.id,
          title: `Ketua ${name}`,
          rank: 'head',
          kind: 'struktural',
          sort_order: 0,
        },
        {
          unitId: unit!.id,
          title: `Staf ${name}`,
          rank: 'staff',
          kind: 'nonstruktural',
          quota,
          sort_order: 1,
        },
      ])
      .returning();
    return {
      unitId: unit!.id,
      headPositionId: head!.id,
      staffPositionId: staff!.id,
    };
  };

  const units: (Awaited<ReturnType<typeof addUnit>> &
    (typeof DIVISIONS)[number])[] = [];
  const heads: Record<string, { email: string; id: string }> = {};
  for (const [i, d] of DIVISIONS.entries()) {
    const u = await addUnit(d.name, i, d.quota);
    const head = await createStudent(
      `ketua-${d.name.toLowerCase()}`,
      personName(),
      2023,
    );
    await db.insert(schema.placement).values({
      positionId: u.headPositionId,
      userId: head.id,
      source: 'manual',
    });
    heads[d.name] = { email: head.email, id: head.id };
    units.push({ ...u, ...d });
  }
  // Bagian non-tujuan yang anggotanya menjadi penilai umum.
  const hr = await addUnit('Kesekretariatan', DIVISIONS.length, 0);
  const generalAssessors: { id: string; email: string }[] = [];
  for (const n of [1, 2, 3]) {
    const p = await createStudent(`penilai${n}`, personName(), 2023);
    await db.insert(schema.placement).values({
      positionId: hr.staffPositionId,
      userId: p.id,
      source: 'manual',
    });
    generalAssessors.push(p);
  }

  // Oprec lewat jalur yang sama dengan wizard ---------------------------
  const caller = createCallerFactory(createTRPCRouter({ oprec: oprecRouter }))({
    db,
    session: {
      user: { id: owner!.id, role: 'lembaga', lembagaId: lembaga!.id },
      expires: '',
    },
    headers: new Headers(),
  } as never);
  const { recruitmentId, formId } = await caller.oprec.createFromSetup({
    eventId: event!.id,
    name: `Oprec Kepanitiaan Mock ${run}`,
    form: { mode: 'template' },
    divisions: units.map((u) => ({
      unitId: u.unitId,
      positionId: u.staffPositionId,
    })),
    minChoices: 1,
    maxChoices: 3,
    attachments: ['CV', 'Portofolio', 'Twibbon'],
    grouping: 'per_divisi',
    waves: [
      {
        label: '1',
        startsAt: new Date('2026-10-20T00:00:00+07:00'),
        endsAt: new Date('2026-11-01T23:59:00+07:00'),
      },
      {
        label: '2',
        startsAt: new Date('2026-11-02T00:00:00+07:00'),
        endsAt: new Date('2026-11-10T23:59:00+07:00'),
      },
    ],
    settings: {
      scoringMode: 'skor',
      statusMethod: 'peringkat_kuota_minimum',
      scoreSource: 'gabungan',
      assessorMode: 'keduanya',
      hasGugur: true,
      headDecides: true,
      stagedPlacement: true,
      resultsAccess: 'admin_ketua',
      closerecEnabled: true,
    },
    generalAssessorUnitId: hr.unitId,
    criteria: [
      { scope: 'umum', name: 'Motivasi', kind: 'skor', weight: 30 },
      { scope: 'umum', name: 'Komitmen waktu', kind: 'skor', weight: 20 },
      { scope: 'umum', name: 'Twibbon terunggah', kind: 'gugur_manual' },
      ...units.flatMap((u) => [
        {
          scope: u.unitId,
          name: 'Pengalaman relevan',
          kind: 'skor' as const,
          weight: 30,
        },
        {
          scope: u.unitId,
          name: 'Pemahaman tugas divisi',
          kind: 'skor' as const,
          weight: 20,
        },
      ]),
    ],
    answers: {
      rubrics: 'keduanya',
      seededBy: 'scripts/oprec/seed-mock.seed.ts',
    },
  });

  // Pertanyaan umum tambahan supaya kriteria umum punya jawaban untuk dibaca.
  const [mainSection] = await db
    .select()
    .from(schema.formSection)
    .where(eq(schema.formSection.formId, formId))
    .orderBy(schema.formSection.sortOrder)
    .limit(1);
  const [motivField, timeField] = await db
    .insert(schema.formField)
    .values([
      {
        formId,
        sectionId: mainSection!.id,
        type: 'long_text',
        label: 'Ceritakan motivasimu mendaftar kepanitiaan ini.',
        required: true,
        config: {},
        sortOrder: 50,
      },
      {
        formId,
        sectionId: mainSection!.id,
        type: 'long_text',
        label: 'Berapa jam per minggu yang bisa kamu sediakan, dan kapan saja?',
        required: true,
        config: {},
        sortOrder: 51,
      },
    ])
    .returning();
  const fields = await db
    .select()
    .from(schema.formField)
    .where(eq(schema.formField.formId, formId));
  const detail = await caller.oprec.get({ recruitmentId });
  const divisionOf = new Map(detail.divisions.map((d) => [d.unitName, d]));
  const sectionField = new Map(
    fields
      .filter(
        (f) =>
          f.type === 'long_text' &&
          f.label.startsWith('Mengapa kamu tertarik ke '),
      )
      .map((f) => [
        f.label.replace('Mengapa kamu tertarik ke ', '').replace(/\?$/, ''),
        f,
      ]),
  );

  // Tautkan kriteria ke pertanyaan yang relevan (panel jawaban di Nilai).
  const criteria = await db
    .select()
    .from(schema.criterion)
    .where(eq(schema.criterion.recruitmentId, recruitmentId));
  const links: { criterionId: string; formFieldId: string }[] = [];
  for (const c of criteria) {
    if (c.divisionId === null) {
      const f =
        c.name === 'Motivasi'
          ? motivField
          : c.name === 'Komitmen waktu'
            ? timeField
            : fields.find((x) => x.label === 'Tautan Twibbon');
      if (f) links.push({ criterionId: c.id, formFieldId: f.id });
    } else {
      const name = detail.divisions.find(
        (d) => d.id === c.divisionId,
      )!.unitName;
      links.push({
        criterionId: c.id,
        formFieldId: sectionField.get(name)!.id,
      });
    }
  }
  await db.insert(schema.criterionField).values(links);

  // Pendaftar ----------------------------------------------------------
  const waves = detail.waves;
  const weighted = units.flatMap((u) =>
    Array<string>(u.popularity).fill(u.name),
  );
  const applicants: { applicationId: string; quality: number }[] = [];
  for (let i = 0; i < APPLICANTS; i++) {
    const name = personName();
    const user = await createStudent(
      `pendaftar${String(i + 1).padStart(3, '0')}`,
      name,
    );
    const count = chance(0.25) ? 1 : chance(0.45) ? 2 : 3;
    const chosen: string[] = [];
    while (chosen.length < count) {
      const n = pick(weighted);
      if (!chosen.includes(n)) chosen.push(n);
    }
    const wave = i < APPLICANTS * 0.65 ? waves[0]! : waves[1]!;
    const span = wave.endsAt.getTime() - wave.startsAt.getTime();
    const submittedAt = new Date(wave.startsAt.getTime() + rand() * span);
    const [sub] = await db
      .insert(schema.formSubmission)
      .values({ formId, userId: user.id, submittedAt, updatedAt: submittedAt })
      .returning();
    const answer = (f: (typeof fields)[number] | undefined, value: unknown) =>
      f
        ? {
            submissionId: sub!.id,
            fieldId: f.id,
            fieldLabel: f.label,
            fieldType: f.type,
            value,
          }
        : null;
    const rows = [
      answer(
        fields.find((f) => f.type === 'unit_choice'),
        chosen.map((n) => ({ optionId: divisionOf.get(n)!.id, label: n })),
      ),
      ...fields
        .filter((f) => f.type === 'link')
        .map((f) => answer(f, driveLink())),
      answer(motivField, answerText()),
      answer(timeField, pick(CLOSERS)),
      ...chosen.map((n) => answer(sectionField.get(n), answerText(n))),
    ].filter((r) => r !== null);
    await db.insert(schema.formAnswer).values(rows);
    const applicationId = await createApplicationFromSubmission(db as never, {
      recruitmentId,
      userId: user.id,
      waveId: wave.id,
      formSubmissionId: sub!.id,
      divisionIds: chosen.map((n) => divisionOf.get(n)!.id),
      willingToMove: false,
    });
    await db
      .update(schema.application)
      .set({ submittedAt })
      .where(eq(schema.application.id, applicationId));
    applicants.push({ applicationId, quality: 3.5 + normal() * 0.9 });
  }

  // Penilaian sebagian: umum oleh penilai umum, divisi oleh ketuanya ------
  const choices = await db
    .select()
    .from(schema.applicationChoice)
    .where(
      inArray(
        schema.applicationChoice.applicationId,
        applicants.map((a) => a.applicationId),
      ),
    );
  const generalCriteria = criteria.filter((c) => c.divisionId === null);
  const assessments: (typeof schema.assessment.$inferInsert)[] = [];
  for (const a of applicants) {
    if (!chance(0.8)) continue;
    const scorers = chance(0.3)
      ? generalAssessors.slice(0, 2)
      : [pick(generalAssessors)];
    for (const s of scorers) {
      for (const c of generalCriteria) {
        if (c.kind === 'gugur_manual') {
          assessments.push({
            applicationId: a.applicationId,
            criterionId: c.id,
            assessorId: s.id,
            gateState: chance(0.9)
              ? 'memenuhi'
              : chance(0.5)
                ? 'ditinjau'
                : 'tidak',
          });
        } else if (chance(0.95)) {
          assessments.push({
            applicationId: a.applicationId,
            criterionId: c.id,
            assessorId: s.id,
            rating: clampRating(a.quality + normal() * 0.7),
            note: chance(0.12) ? pick(NOTES) : null,
          });
        }
      }
    }
  }
  const quality = new Map(applicants.map((a) => [a.applicationId, a.quality]));
  for (const ch of choices) {
    const division = detail.divisions.find((d) => d.id === ch.divisionId)!;
    const p = ch.rank === 1 ? 0.75 : ch.rank === 2 ? 0.5 : 0.35;
    if (!chance(p)) continue;
    const fit = quality.get(ch.applicationId)! + normal() * 0.8;
    const own = criteria.filter((c) => c.divisionId === ch.divisionId);
    const partial = chance(0.1);
    for (const [k, c] of own.entries()) {
      if (partial && k > 0) break;
      assessments.push({
        applicationId: ch.applicationId,
        choiceId: ch.id,
        criterionId: c.id,
        assessorId: heads[division.unitName]!.id,
        rating: clampRating(fit + normal() * 0.5),
        note: chance(0.1) ? pick(NOTES) : null,
      });
    }
  }
  for (let i = 0; i < assessments.length; i += 500) {
    await db.insert(schema.assessment).values(assessments.slice(i, i + 500));
  }
  await recomputeDivisions(db as never, recruitmentId, 'all');
  await db
    .update(schema.recruitment)
    .set({ status: 'closed' })
    .where(eq(schema.recruitment.id, recruitmentId));
  await db
    .update(schema.form)
    .set({ status: 'Closed' })
    .where(eq(schema.form.id, formId));

  const statusCount = await db
    .select({ s: schema.applicationChoice.computedStatus })
    .from(schema.applicationChoice)
    .where(
      inArray(
        schema.applicationChoice.applicationId,
        applicants.map((a) => a.applicationId),
      ),
    );
  const tally = statusCount.reduce<Record<string, number>>((m, r) => {
    const k = r.s ?? 'null';
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  const mockUsers = await db
    .select({ n: schema.users.id })
    .from(schema.users)
    .where(like(schema.users.email, `%-${run}@${DOMAIN}`));

  console.log(
    JSON.stringify(
      {
        run,
        paths: {
          lembaga: `/lembaga/kegiatan/${event!.id}/oprec/${recruitmentId}/nilai`,
          penilai: `/manage/kegiatan/${event!.id}/oprec/${recruitmentId}/nilai`,
        },
        eventId: event!.id,
        recruitmentId,
        formId,
        akun: {
          pengelola: owner!.email,
          penilaiUmum: generalAssessors.map((g) => g.email),
          ketua: Object.fromEntries(
            Object.entries(heads).map(([k, v]) => [k, v.email]),
          ),
          contohPendaftar: mail('pendaftar001'),
        },
        jumlah: {
          akun: mockUsers.length,
          pendaftar: applicants.length,
          pilihan: choices.length,
          penilaian: assessments.length,
          statusPilihan: tally,
        },
      },
      null,
      2,
    ),
  );
  await client.end();
}, 300_000);
