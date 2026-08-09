import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

import { db } from '../index.js';
import {
  // accounts,
  associationRequests,
  associationRequestsLembaga,
  bestStaffKegiatan,
  bestStaffLembaga,
  events,
  keanggotaan,
  kehimpunan,
  lembaga,
  mahasiswa,
  nilaiProfilKegiatan,
  nilaiProfilLembaga,
  notifications,
  pemetaanProfilKegiatan,
  pemetaanProfilLembaga,
  profilKM,
  profilKegiatan,
  profilLembaga,
  support,
  supportReplies,
  users,
  verificationTokens,
  verifiedUsers,
} from '../schema.js';

// Utility functions for parsing CSV values

const TEST_EMAIL = 'your-nim@std.stei.itb.ac.id'; // Change this to your own private email
const TEST_EMAIL_MAHASISWA = 'your-nim@mahasiswa.itb.ac.id'; // Change this to your own nim

const CSV_DIR = path.join(
  process.cwd(),
  'src',
  'server',
  'db',
  'seeding',
  'data',
);

type CsvRow = Record<string, string | undefined>;

function readCsvFile(filename: string): CsvRow[] {
  const filePath = path.join(CSV_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ CSV file not found: ${filename}`);
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, _context) => {
      // Handle boolean values
      if (value === 'true' || value === 'True') return true;
      if (value === 'false' || value === 'False') return false;

      // Handle empty strings as null for optional fields
      if (value === '') return null;

      return value;
    },
  }); // Type assertion to CsvRow[]

  return records as CsvRow[];
}

function parseDate(dateString: string | undefined | null): Date | null {
  if (!dateString || dateString === '') return null;
  return new Date(dateString);
}

function parseInteger(value: string | undefined | null): number | null {
  if (!value || value === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseBoolean(value: string | undefined | null): boolean {
  return value === 'true' || value === 'True';
}

async function importVerifiedUsers() {
  console.log('📧 Importing verified users...');
  const records = readCsvFile('verified_users.csv');

  if (records.length === 0) return;

  const data = records
    .filter((record) => record.email) // Only include records with email
    .map((record) => ({
      id: record.id ?? crypto.randomUUID(),
      email: record.email!,
    }));

  if (data.length > 0) {
    await db.insert(verifiedUsers).values(data);
    console.log(`✅ Imported ${data.length} verified users`);
  }
}

async function importUsers() {
  console.log('👥 Importing users...');
  const records = readCsvFile('users.csv');

  if (records.length === 0) return;

  const data = records
    .filter((record) => record.email && record.id) // Only include records with required fields
    .map((record) => ({
      id: record.id!,
      name: record.name ?? null,
      email: record.email!,
      emailVerified: parseDate(record.email_verified),
      image: record.image ?? null,
      role: (record.role as 'admin' | 'lembaga' | 'mahasiswa') ?? 'mahasiswa',
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(users).values(data);
    console.log(`✅ Imported ${data.length} users`);
  }
}

async function importMahasiswa() {
  console.log('🎓 Importing mahasiswa...');
  const records = readCsvFile('mahasiswa.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.user_id && record.nim && record.jurusan && record.angkatan,
    )
    .map((record) => ({
      userId: record.user_id!,
      nim: parseInteger(record.nim) ?? 0,
      jurusan: record.jurusan!,
      angkatan: parseInteger(record.angkatan) ?? 2024,
      lineId: record.line_id ?? null,
      whatsapp: record.whatsapp ?? null,
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(mahasiswa).values(data);
    console.log(`✅ Imported ${data.length} mahasiswa`);
  }
}

async function importLembaga() {
  console.log('🏢 Importing lembaga...');
  const records = readCsvFile('lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.user_id && record.name && record.founding_date,
    )
    .map((record) => ({
      id: record.id!,
      userId: record.user_id!,
      name: record.name!,
      description: record.description ?? null,
      foundingDate: parseDate(record.founding_date) ?? new Date(),
      endingDate: parseDate(record.ending_date),
      type: record.type as 'Himpunan' | 'UKM' | 'Kepanitiaan' | null,
      major: record.major ?? null,
      field: record.field ?? null,
      memberCount: parseInteger(record.member_count),
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(lembaga).values(data);
    console.log(`✅ Imported ${data.length} lembaga`);
  }
}

async function importEvents() {
  console.log('📅 Importing events...');
  const records = readCsvFile('events.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.name && record.start_date && record.status,
    )
    .map((record) => ({
      id: record.id!,
      org_id: record.org_id ?? null,
      name: record.name!,
      description: record.description ?? null,
      image: record.image ?? null,
      background_image: record.background_image ?? null,
      start_date: parseDate(record.start_date) ?? new Date(),
      end_date: parseDate(record.end_date),
      status: record.status as 'Coming Soon' | 'On going' | 'Ended',
      oprec_link: record.oprec_link ?? null,
      location: record.location ?? null,
      participant_limit: parseInteger(record.participant_limit) ?? 0,
      participant_count: parseInteger(record.participant_count) ?? 0,
      is_highlighted: parseBoolean(record.is_highlighted),
      is_organogram: parseBoolean(record.is_organogram),
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
      organogram_image: null,
    }));

  if (data.length > 0) {
    await db.insert(events).values(data);
    console.log(`✅ Imported ${data.length} events`);
  }
}

async function importKeanggotaan() {
  console.log('👤 Importing keanggotaan...');
  const records = readCsvFile('keanggotaan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id &&
        record.event_id &&
        record.user_id &&
        record.position &&
        record.division,
    )
    .map((record) => ({
      id: record.id!,
      event_id: record.event_id!,
      user_id: record.user_id!,
      position: record.position!,
      division: record.division!,
      description: record.description ?? null,
    }));

  if (data.length > 0) {
    await db.insert(keanggotaan).values(data);
    console.log(`✅ Imported ${data.length} keanggotaan`);
  }
}

async function importAssociationRequests() {
  console.log('📝 Importing association requests...');
  const records = readCsvFile('association_requests.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.position && record.division && record.status,
    )
    .map((record) => ({
      id: record.id!,
      event_id: record.event_id ?? null,
      user_id: record.user_id ?? null,
      position: record.position!,
      division: record.division!,
      status: record.status as 'Pending' | 'Accepted' | 'Declined',
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(associationRequests).values(data);
    console.log(`✅ Imported ${data.length} association requests`);
  }
}

async function importAssociationRequestsLembaga() {
  console.log('📋 Importing lembaga association requests...');
  const records = readCsvFile('association_requests_lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.position && record.division && record.status,
    )
    .map((record) => ({
      id: record.id!,
      lembagaId: record.lembagaId ?? null,
      user_id: record.user_id ?? null,
      position: record.position!,
      division: record.division!,
      status: record.status as 'Pending' | 'Accepted' | 'Declined',
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(associationRequestsLembaga).values(data);
    console.log(`✅ Imported ${data.length} lembaga association requests`);
  }
}

async function importSupport() {
  console.log('🎫 Importing support tickets...');
  const records = readCsvFile('support.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id &&
        record.subject &&
        record.topic &&
        record.description &&
        record.status,
    )
    .map((record) => ({
      id: record.id!,
      user_id: record.user_id ?? null,
      subject: record.subject!,
      topic: record.topic!,
      description: record.description!,
      status: 'In Progress' as 'Draft' | 'In Progress' | 'Resolved' | 'Reported',
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(support).values(data);
    console.log(`✅ Imported ${data.length} support tickets`);
  }
}

async function importNotifications() {
  console.log('🔔 Importing notifications...');
  const records = readCsvFile('notifications.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) => record.id && record.title && record.content && record.type,
    )
    .map((record) => ({
      id: record.id!,
      user_id: record.user_id ?? null,
      title: record.title!,
      content: record.content!,
      type: record.type as 'Association Request' | 'System',
      read: parseBoolean(record.read),
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(notifications).values(data);
    console.log(`✅ Imported ${data.length} notifications`);
  }
}

// async function importAccounts() {
//   console.log('🔐 Importing accounts...');
//   const records = readCsvFile('accounts.csv');

//   if (records.length === 0) return;

//   const data = records
//     .filter((record) => record.user_id && record.type && record.provider)
//     .map((record) => ({
//       userId: record.user_id!,
//       type: record.type as 'oauth' | 'email' | 'oidc',
//       provider: record.provider!,
//       providerAccountId: record.provider_account_id!,
//       refresh_token: record.refresh_token ?? null,
//       access_token: record.access_token ?? null,
//       expires_at: parseInteger(record.expires_at),
//       token_type: record.token_type ?? null,
//       scope: record.scope ?? null,
//       id_token: record.id_token ?? null,
//       session_state: record.session_state ?? null,
//     }));

//   if (data.length > 0) {
//     await db.insert(accounts).values(data);
//     console.log(`✅ Imported ${data.length} accounts`);
//   }
// }

// COMMENTED OUT - Session seeding removed as requested
/*
async function importSessions() {
  console.log('🔑 Importing sessions...');
  const records = readCsvFile('sessions.csv');
  
  if (records.length === 0) return;
  
  const data = records
    .filter(record => record.session_token && record.user_id && record.expires)
    .map(record => ({
      sessionToken: record.session_token!,
      userId: record.user_id!,
      expires: parseDate(record.expires) ?? new Date(),
    }));
  
  if (data.length > 0) {
    await db.insert(sessions).values(data);
    console.log(`✅ Imported ${data.length} sessions`);
  }
}
*/

async function importVerificationTokens() {
  console.log('🎫 Importing verification tokens...');
  const records = readCsvFile('verification_tokens.csv');

  if (records.length === 0) return;

  const data = records
    .filter((record) => record.identifier && record.token && record.expires)
    .map((record) => ({
      identifier: record.identifier!,
      token: record.token!,
      expires: parseDate(record.expires) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(verificationTokens).values(data);
    console.log(`✅ Imported ${data.length} verification tokens`);
  }
}

async function importKehimpunan() {
  console.log('🤝 Importing kehimpunan...');
  const records = readCsvFile('kehimpunan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id &&
        record.userId &&
        record.lembagaId &&
        record.division &&
        record.position,
    )
    .map((record) => ({
      id: record.id!,
      userId: record.userId!,
      lembagaId: record.lembagaId!,
      division: record.division!,
      position: record.position!,
    }));

  if (data.length > 0) {
    await db.insert(kehimpunan).values(data);
    console.log(`✅ Imported ${data.length} kehimpunan`);
  } else {
    console.log(`⚠️ Kehimpunan is empty`);
  }
}

async function importBestStaffKegiatan() {
  console.log('⭐ Importing best staff kegiatan...');
  const records = readCsvFile('best_staff_kegiatan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id &&
        record.eventId &&
        record.mahasiswaId &&
        record.division &&
        record.startDate &&
        record.endDate,
    )
    .map((record) => ({
      id: record.id!,
      eventId: record.eventId!,
      mahasiswaId: record.mahasiswaId!,
      division: record.division!,
      startDate: parseDate(record.startDate) ?? new Date(),
      endDate: parseDate(record.endDate) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(bestStaffKegiatan).values(data);
    console.log(`✅ Imported ${data.length} best staff kegiatan`);
  }
}

async function importBestStaffLembaga() {
  console.log('🌟 Importing best staff lembaga...');
  const records = readCsvFile('best_staff_lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id &&
        record.lembagaId &&
        record.mahasiswaId &&
        record.division &&
        record.startDate &&
        record.endDate,
    )
    .map((record) => ({
      id: record.id!,
      lembagaId: record.lembagaId!,
      mahasiswaId: record.mahasiswaId!,
      division: record.division!,
      startDate: parseDate(record.startDate) ?? new Date(),
      endDate: parseDate(record.endDate) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(bestStaffLembaga).values(data);
    console.log(`✅ Imported ${data.length} best staff lembaga`);
  }
}

async function importSupportReplies() {
  console.log('💬 Importing support replies...');
  const records = readCsvFile('support_replies.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.reply_id && record.user_id && record.support_id && record.text,
    )
    .map((record) => ({
      reply_id: record.reply_id!,
      user_id: record.user_id!,
      support_id: record.support_id!,
      text: record.text!,
      created_at: parseDate(record.created_at) ?? new Date(),
      updated_at: parseDate(record.updated_at) ?? new Date(),
    }));

  if (data.length > 0) {
    await db.insert(supportReplies).values(data);
    console.log(`✅ Imported ${data.length} support replies`);
  }
}

async function importProfilKM() {
  console.log('👥 Importing profil KM...');
  const records = readCsvFile('profil_km.csv');

  if (records.length === 0) return;

  const data = records
    .filter((record) => record.id && record.description)
    .map((record) => ({
      id: record.id!,
      description: record.description!,
    }));

  if (data.length > 0) {
    await db.insert(profilKM).values(data);
    console.log(`✅ Imported ${data.length} profil KM`);
  }
}

async function importProfilKegiatan() {
  console.log('🎯 Importing profil kegiatan...');
  const records = readCsvFile('profil_kegiatan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.eventId && record.name && record.description,
    )
    .map((record) => ({
      id: record.id!,
      eventId: record.eventId!,
      name: record.name!,
      description: record.description!,
    }));

  if (data.length > 0) {
    await db.insert(profilKegiatan).values(data);
    console.log(`✅ Imported ${data.length} profil kegiatan`);
  }
}

async function importProfilLembaga() {
  console.log('🏛️ Importing profil lembaga...');
  const records = readCsvFile('profil_lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.lembagaId && record.name && record.description,
    )
    .map((record) => ({
      id: record.id!,
      lembagaId: record.lembagaId!,
      name: record.name!,
      description: record.description!,
    }));

  if (data.length > 0) {
    await db.insert(profilLembaga).values(data);
    console.log(`✅ Imported ${data.length} profil lembaga`);
  }
}

async function importPemetaanProfilKegiatan() {
  console.log('🗺️ Importing pemetaan profil kegiatan...');
  const records = readCsvFile('pemetaan_profil_kegiatan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) => record.id && record.profil_kegiatan_id && record.profil_km_id,
    )
    .map((record) => ({
      id: record.id!,
      profilKegiatanId: record.profil_kegiatan_id!,
      profilKMId: record.profil_km_id!,
    }));

  if (data.length > 0) {
    await db.insert(pemetaanProfilKegiatan).values(data);
    console.log(`✅ Imported ${data.length} pemetaan profil kegiatan`);
  }
}

async function importPemetaanProfilLembaga() {
  console.log('🗂️ Importing pemetaan profil lembaga...');
  const records = readCsvFile('pemetaan_profil_lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) => record.id && record.profil_lembaga_id && record.profil_km_id,
    )
    .map((record) => ({
      id: record.id!,
      profilLembagaId: record.profil_lembaga_id!,
      profilKMId: record.profil_km_id!,
    }));

  if (data.length > 0) {
    await db.insert(pemetaanProfilLembaga).values(data);
    console.log(`✅ Imported ${data.length} pemetaan profil lembaga`);
  }
}

async function importNilaiProfilKegiatan() {
  console.log('📊 Importing nilai profil kegiatan...');
  const records = readCsvFile('nilai_profil_kegiatan.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.profil_id && record.mahasiswa_id && record.nilai,
    )
    .map((record) => ({
      id: record.id!,
      profilId: record.profil_id!,
      mahasiswaId: record.mahasiswa_id!,
      nilai: parseInteger(record.nilai) ?? 0,
    }));

  if (data.length > 0) {
    await db.insert(nilaiProfilKegiatan).values(data);
    console.log(`✅ Imported ${data.length} nilai profil kegiatan`);
  }
}

async function importNilaiProfilLembaga() {
  console.log('📈 Importing nilai profil lembaga...');
  const records = readCsvFile('nilai_profil_lembaga.csv');

  if (records.length === 0) return;

  const data = records
    .filter(
      (record) =>
        record.id && record.profil_id && record.mahasiswa_id && record.nilai,
    )
    .map((record) => ({
      id: record.id!,
      profilId: record.profil_id!,
      mahasiswaId: record.mahasiswa_id!,
      nilai: parseInteger(record.nilai) ?? 0,
    }));

  if (data.length > 0) {
    await db.insert(nilaiProfilLembaga).values(data);
    console.log(`✅ Imported ${data.length} nilai profil lembaga`);
  }
}

export async function seedFromCsv() {
  console.log('🌱 Starting CSV import seeding...');
  console.log(`📁 Reading CSV files from: ${CSV_DIR}`);

  try {
    // Import in dependency order
    await importVerifiedUsers();
    await importUsers();
    await importMahasiswa();
    await importLembaga();
    await importEvents();
    // await importAccounts();
    await importVerificationTokens();
    await importKeanggotaan();
    await importKehimpunan();
    await importAssociationRequests();
    await importAssociationRequestsLembaga();
    await importBestStaffKegiatan();
    await importBestStaffLembaga();
    await importSupport();
    await importSupportReplies();
    await importNotifications();
    await importProfilKM();
    await importProfilKegiatan();
    await importProfilLembaga();
    await importPemetaanProfilKegiatan();
    await importPemetaanProfilLembaga();
    await importNilaiProfilKegiatan();
    await importNilaiProfilLembaga();

    console.log('🎉 CSV import completed successfully!');

    // @TODO: Ini short-term solution, tidak untuk digunakan di production.
    const randomLembaga = await db.query.users.findFirst({
      where: eq(users.role, 'lembaga'),
    });

    if (randomLembaga) {
      await db
        .update(users)
        .set({ email: TEST_EMAIL })
        .where(eq(users.id, randomLembaga.id));
      console.log(`✅ Updated random lembaga's email to ${TEST_EMAIL}`);
    }

    const randomMahasiswa = await db.query.users.findFirst({
      where: eq(users.role, 'mahasiswa'),
    });

    if (randomMahasiswa) {
      await db
        .update(users)
        .set({ email: TEST_EMAIL_MAHASISWA })
        .where(eq(users.id, randomMahasiswa.id));
      console.log(`✅ Updated random user's email to ${TEST_EMAIL_MAHASISWA}`);
    }

    // email lembaga seeding
    const existingUser = await db.query.verifiedUsers.findFirst({
      where: eq(verifiedUsers.email, TEST_EMAIL),
    });

    if (existingUser) {
      console.log('⚠️ User already exists');
      return;
    }

    // 1. Add to verified users first
    await db.insert(verifiedUsers).values({
      email: TEST_EMAIL,
    });

    // console.log('✅ Added email to verified users');
    // console.log(`Email: ${TEST_EMAIL}`);
    // console.log(
    //   '🔗 Now you can sign in with Google and the user/lembaga records will be created automatically',
    // );

    // //@TODO: delete ini console log di bawah
    // console.log('Ini adalah solusi jangka pendek, berikut adalah caranya:');
    // console.log('1. Ubah TEST_EMAIL ke email pribadi');
    // console.log('2. lakukan login di localhost:3000');
    // console.log("3. Buka drizzle (di terminal lain, 'npm run db:studio'");
    // console.log(
    //   '4. di tabel anmategra_user, cari salah satu user dengan role lembaga',
    // );
    // console.log('5. ganti email user tersebut dengan TEST_EMAIL');
    // console.log(
    //   '6. di tabel anmategra_account, ganti user_id dengan id user yang tadi diubah emailnya',
    // );
    // console.log(
    //   '7. Selesai, sekarang coba login dengan email tersebut, seharusnya sudah bisa masuk sebagai lembaga.',
    // );
    // console.log(
    //   'Kalau bingung, tanya wakadiv kalian atau message yang ngepush ini jg gpp',
    // );
  } catch (error) {
    console.error('❌ Error during CSV import:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seedFromCsv().catch(console.error);
