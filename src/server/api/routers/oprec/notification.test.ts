import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '~/server/db/schema';
import {
  applyToOprec,
  callerFor,
  choicesOf,
  createOprecFixture,
} from '~/test/oprec-fixture';
import {
  createMahasiswa,
  createTestDb,
  createUser,
  resetDb,
} from '~/test/test-db';

const { db, close } = createTestDb();

beforeEach(async () => {
  await resetDb(db);
});
afterAll(async () => {
  await close();
});

/** Satu pendaftar diterima di Acara, satu ditolak, satu Humas belum diputuskan. */
async function world() {
  const fx = await createOprecFixture(db);
  const accepted = await applyToOprec(db, fx, ['Acara']);
  const rejected = await applyToOprec(db, fx, ['Acara']);
  const humas = await applyToOprec(db, fx, ['Humas']);
  const kadiv = callerFor(db, fx.divisions.Acara!.kadiv);
  const [acceptedChoice] = await choicesOf(db, accepted.applicationId);
  const [rejectedChoice] = await choicesOf(db, rejected.applicationId);
  await kadiv.oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: acceptedChoice!.id,
    decision: 'terima',
  });
  await kadiv.oprec.decide({
    recruitmentId: fx.recruitmentId,
    choiceId: rejectedChoice!.id,
    decision: 'tolak',
  });
  return {
    fx,
    accepted,
    rejected,
    humas,
    owner: callerFor(db, fx.owner),
  };
}

const notificationsFor = (userId: string) =>
  db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.user_id, userId));

describe('pemberitahuan manual oprec', () => {
  it('mengirim ke semua pendaftar, bisa diulang, dan tautannya ke form', async () => {
    const { fx, accepted, rejected, humas, owner } = await world();
    const input = {
      recruitmentId: fx.recruitmentId,
      audience: 'all' as const,
      scope: { kind: 'all' as const },
      title: 'Jadwal wawancara',
      content: 'Wawancara digelar Sabtu pukul 09.00 WIB.',
    };

    expect(await owner.oprec.sendApplicantNotification(input)).toEqual({
      sent: 3,
    });

    const [notification] = await notificationsFor(accepted.userId);
    expect(notification).toMatchObject({
      title: 'Jadwal wawancara',
      content: 'Wawancara digelar Sabtu pukul 09.00 WIB.',
      type: 'System',
      kind: 'manual',
      recruitmentId: fx.recruitmentId,
    });
    expect(notification!.links).toEqual([
      { label: 'Buka halaman pendaftaran', href: `/forms/${fx.formId}` },
    ]);
    expect(await notificationsFor(rejected.userId)).toHaveLength(1);
    expect(await notificationsFor(humas.userId)).toHaveLength(1);

    // Pemberitahuan manual tidak terkena indeks unik hasil oprec.
    await owner.oprec.sendApplicantNotification(input);
    expect(await notificationsFor(accepted.userId)).toHaveLength(2);
  });

  it('membatasi audiens dan menghitung per divisi', async () => {
    const { fx, accepted, rejected, humas, owner } = await world();
    const acara = fx.divisions.Acara!.id;

    const audience = await owner.oprec.notificationAudience({
      recruitmentId: fx.recruitmentId,
      scope: { kind: 'division', divisionId: acara },
    });
    expect(audience.counts).toEqual({
      all: 2,
      accepted: 1,
      rejected: 1,
      undecided: 0,
    });
    expect(audience.divisions.map((division) => division.id)).toContain(acara);

    const result = await owner.oprec.sendApplicantNotification({
      recruitmentId: fx.recruitmentId,
      audience: 'accepted',
      scope: { kind: 'division', divisionId: acara },
      title: 'Selamat',
      content: 'Kamu diterima di Acara.',
    });
    expect(result.sent).toBe(1);
    expect(await notificationsFor(accepted.userId)).toHaveLength(1);
    expect(await notificationsFor(rejected.userId)).toHaveLength(0);
    expect(await notificationsFor(humas.userId)).toHaveLength(0);
  });

  it('menolak audiens kosong tanpa menulis pemberitahuan', async () => {
    const { fx, owner } = await world();
    await expect(
      owner.oprec.sendApplicantNotification({
        recruitmentId: fx.recruitmentId,
        audience: 'accepted',
        scope: { kind: 'division', divisionId: fx.divisions.Humas!.id },
        title: 'Selamat',
        content: 'Kamu diterima.',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await db.select().from(schema.notifications)).toHaveLength(0);
  });

  it('pesan manual langsung tampil di Inbox tanpa menunggu rilis hasil', async () => {
    const { fx, accepted, owner } = await world();
    await owner.oprec.sendApplicantNotification({
      recruitmentId: fx.recruitmentId,
      audience: 'all',
      scope: { kind: 'all' },
      title: 'Pengingat berkas',
      content: 'Lengkapi berkas sebelum Jumat.',
    });

    const viewer = callerFor(db, {
      id: accepted.userId,
      role: 'mahasiswa',
    });
    const list = await viewer.oprec.myResultNotifications();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      title: 'Pengingat berkas',
      read: false,
    });
    expect(list[0]!.links).toEqual([
      { label: 'Buka halaman pendaftaran', href: `/forms/${fx.formId}` },
    ]);
  });

  it('hanya pengelola oprec yang boleh mengirim', async () => {
    const { fx } = await world();
    const stranger = await createUser(db, { role: 'mahasiswa' });
    await createMahasiswa(db, stranger.id);
    await expect(
      callerFor(db, { id: stranger.id, role: 'mahasiswa' }).oprec
        .sendApplicantNotification({
          recruitmentId: fx.recruitmentId,
          audience: 'all',
          scope: { kind: 'all' },
          title: 'Tes',
          content: 'Tes',
        }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
