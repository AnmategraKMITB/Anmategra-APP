import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  createEvent,
  createLembaga,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

import {
  isListedAsKegiatan,
  listedAsKegiatan,
  registrationLink,
} from './period-listing';
import { userKegiatanMemberships } from './routers/organization/membership';

const { db, close } = createTestDb();
const database = db as unknown as Parameters<typeof registrationLink>[0];

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

async function makeLembaga(type: 'Himpunan' | 'UKM' | 'Kepanitiaan') {
  const owner = await createUser(db, { role: 'lembaga' });
  return createLembaga(db, owner.id, { name: `Lembaga ${type}`, type });
}

describe('isListedAsKegiatan', () => {
  it('menampilkan kegiatan dan kepengurusan lembaga Kepanitiaan saja', () => {
    expect(isListedAsKegiatan('kegiatan', 'Himpunan')).toBe(true);
    expect(isListedAsKegiatan('kepengurusan', 'Kepanitiaan')).toBe(true);
    expect(isListedAsKegiatan('kepengurusan', 'Himpunan')).toBe(false);
    expect(isListedAsKegiatan('kepengurusan', null)).toBe(false);
  });
});

describe('listedAsKegiatan', () => {
  it('memilih periode yang sama dengan isListedAsKegiatan', async () => {
    const himpunan = await makeLembaga('Himpunan');
    const kepanitiaan = await makeLembaga('Kepanitiaan');
    await createEvent(db, himpunan.id, {
      id: 'hmj-kegiatan',
      kind: 'kegiatan',
    });
    await createEvent(db, himpunan.id, {
      id: 'hmj-kepengurusan',
      kind: 'kepengurusan',
    });
    await createEvent(db, kepanitiaan.id, {
      id: 'ami-kepengurusan',
      kind: 'kepengurusan',
    });
    await createEvent(db, null, { id: 'tanpa-lembaga', kind: 'kegiatan' });

    // Dipakai di callback `where` query relasional, seperti di router.
    const rows = await db.query.events.findMany({
      where: (events) => listedAsKegiatan(events),
      columns: { id: true },
    });

    expect(rows.map((r) => r.id).sort()).toEqual([
      'ami-kepengurusan',
      'hmj-kegiatan',
      'tanpa-lembaga',
    ]);
  });
});

describe('registrationLink', () => {
  async function makeOprec(
    periodId: string,
    over: {
      slug?: string | null;
      formStatus?: schema.FormStatus;
      closesAt?: Date | null;
      status?: schema.RecruitmentStatus;
    } = {},
  ) {
    const [f] = await db
      .insert(schema.form)
      .values({
        eventId: periodId,
        title: 'Formulir Oprec',
        slug: over.slug === undefined ? 'oprec-uji' : over.slug,
        status: over.formStatus ?? 'Published',
        closesAt: over.closesAt ?? null,
      })
      .returning();
    await db.insert(schema.recruitment).values({
      periodId,
      formId: f!.id,
      name: 'Oprec Uji',
      status: over.status ?? 'open',
    });
    return f!;
  }

  it('mengarah ke formulir oprec yang sedang dibuka, memakai slug', async () => {
    const l = await makeLembaga('Kepanitiaan');
    const period = await createEvent(db, l.id, { kind: 'kepengurusan' });
    await makeOprec(period.id);

    expect(await registrationLink(database, period)).toBe('/forms/oprec-uji');
  });

  it('memakai id formulir bila slug kosong', async () => {
    const l = await makeLembaga('Kepanitiaan');
    const period = await createEvent(db, l.id, { kind: 'kepengurusan' });
    const f = await makeOprec(period.id, { slug: null });

    expect(await registrationLink(database, period)).toBe(`/forms/${f.id}`);
  });

  it('kembali ke oprec_link bila oprec atau formulirnya tidak sedang dibuka', async () => {
    const l = await makeLembaga('Kepanitiaan');
    const cases = [
      { status: 'draft' as const },
      { status: 'closed' as const },
      { formStatus: 'Draft' as const },
      { formStatus: 'Closed' as const },
      { closesAt: new Date('2020-01-01T00:00:00Z') },
    ];
    for (const [i, c] of cases.entries()) {
      const period = await createEvent(db, l.id, {
        kind: 'kegiatan',
        oprec_link: 'https://contoh.com/daftar',
      });
      await makeOprec(period.id, { ...c, slug: `oprec-${i}` });

      expect(await registrationLink(database, period)).toBe(
        'https://contoh.com/daftar',
      );
    }
  });

  it('null bila tidak ada oprec maupun oprec_link', async () => {
    const l = await makeLembaga('Himpunan');
    const period = await createEvent(db, l.id);

    expect(await registrationLink(database, period)).toBeNull();
  });
});

describe('userKegiatanMemberships', () => {
  async function placeIn(
    lembagaId: string,
    kind: 'kegiatan' | 'kepengurusan',
    userId: string,
  ) {
    const period = await createEvent(db, lembagaId, { kind });
    const [structure] = await db
      .insert(schema.organizationStructure)
      .values({ eventId: period.id, name: 'Struktur', is_active: true })
      .returning();
    const [unit] = await db
      .insert(schema.organizationUnit)
      .values({ structure_id: structure!.id, name: 'Divisi Acara', level: 1 })
      .returning();
    const [position] = await db
      .insert(schema.organizationPosition)
      .values({
        unitId: unit!.id,
        title: 'Ketua Divisi',
        rank: 'head',
        kind: 'struktural',
      })
      .returning();
    await db
      .insert(schema.placement)
      .values({ positionId: position!.id, userId, source: 'manual' });
    return period;
  }

  it('menampilkan posisi di kepengurusan lembaga Kepanitiaan sebagai kegiatan', async () => {
    const user = await createUser(db);
    const kepanitiaan = await makeLembaga('Kepanitiaan');
    const himpunan = await makeLembaga('Himpunan');
    const ami = await placeIn(kepanitiaan.id, 'kepengurusan', user.id);
    await placeIn(himpunan.id, 'kepengurusan', user.id);

    const rows = await userKegiatanMemberships(db as never, user.id);

    expect(rows.map((r) => [r.event.id, r.division, r.position])).toEqual([
      [ami.id, 'Divisi Acara', 'Ketua Divisi'],
    ]);
  });
});
