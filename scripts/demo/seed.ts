/**
 * Seed akun demo. Idempoten; jalankan hanya dengan APP_ENV=demo.
 *
 *   APP_ENV=demo DATABASE_URL=... npx tsx scripts/demo/seed.ts
 *
 * Password semua akun demo berasal dari DEMO_PASSWORD_HASH di env deployment.
 */
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { lembaga, mahasiswa, users } from '~/server/db/schema';

if (process.env.APP_ENV !== 'demo') {
  throw new Error('Seed demo hanya boleh dijalankan saat APP_ENV=demo.');
}

type DemoAccount = {
  email: string;
  name: string;
  role: 'admin' | 'lembaga' | 'mahasiswa';
  mahasiswa?: { nim: number; jurusan: string; angkatan: number };
  lembaga?: {
    name: string;
    type: 'Himpunan' | 'UKM' | 'Kepanitiaan' | 'BSO' | 'Badan' | 'Pusat' | 'Organisasi';
    acronym?: string;
  };
};

const accounts: DemoAccount[] = [
  {
    email: 'demo.admin@demo.anmategra.local',
    name: 'Demo Admin',
    role: 'admin',
  },
  {
    email: 'demo.mahasiswa@demo.anmategra.local',
    name: 'Demo Mahasiswa',
    role: 'mahasiswa',
    mahasiswa: { nim: 13523001, jurusan: 'Teknik Informatika', angkatan: 2023 },
  },
  {
    email: 'demo.lembaga@demo.anmategra.local',
    name: 'Demo Himpunan',
    role: 'lembaga',
    lembaga: {
      name: 'Himpunan Demo',
      type: 'Himpunan',
      acronym: 'HMD',
    },
  },
  {
    email: '13523094@mahasiswa.itb.ac.id',
    name: 'Admin Mahasiswa',
    role: 'mahasiswa',
    mahasiswa: { nim: 13523094, jurusan: 'Teknik Informatika', angkatan: 2023 },
  },
  {
    email: 'anmategra@km.itb.ac.id',
    name: 'Admin Anmategra',
    role: 'lembaga',
    lembaga: {
      name: 'Anmategra',
      type: 'Kepanitiaan',
      acronym: 'ANM',
    },
  },
];

for (const account of accounts) {
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

  if (account.mahasiswa) {
    const row = await db.query.mahasiswa.findFirst({
      where: eq(mahasiswa.userId, user.id),
    });
    if (!row) {
      await db.insert(mahasiswa).values({
        userId: user.id,
        nim: account.mahasiswa.nim,
        nama: account.name,
        jurusan: account.mahasiswa.jurusan,
        angkatan: account.mahasiswa.angkatan,
        status: 'aktif',
      });
    }
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
        foundingDate: new Date(),
      });
    }
  }

  console.log(`✓ ${account.email} (${account.role})`);
}

console.log('\nSelesai. Gunakan password dari DEMO_PASSWORD_HASH deployment demo.');
process.exit(0);
