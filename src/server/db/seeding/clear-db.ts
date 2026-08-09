import 'dotenv/config';

import { db } from '../index';
import {
  accounts,
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
  sessions,
  support,
  supportReplies,
  users,
  verificationTokens,
  verifiedUsers,
} from '../schema';

async function clearAllTables() {
  console.log('🧹 Force clearing all database tables...');

  try {
    // Use Drizzle delete method to safely clear tables that exist
    // Clear in order of dependencies (child tables first)

    console.log('Clearing table data using Drizzle ORM...');

    // Helper function to safely delete from table
    const safeDelete = async (table: any, tableName: string) => {
      try {
        console.log(`Clearing table: ${tableName}`);
        // eslint-disable-next-line drizzle/enforce-delete-with-where
        await db.delete(table);
        console.log(`✅ Cleared ${tableName}`);
      } catch (error: any) {
        if ((error as { code?: string })?.code === '42P01') {
          console.log(`⚠️  Table ${tableName} does not exist, skipping...`);
        } else {
          console.error(`❌ Error clearing ${tableName}:`, error);
          throw error;
        }
      }
    };

    // Clear tables in dependency order
    await safeDelete(nilaiProfilLembaga, 'nilaiProfilLembaga');
    await safeDelete(nilaiProfilKegiatan, 'nilaiProfilKegiatan');
    await safeDelete(pemetaanProfilLembaga, 'pemetaanProfilLembaga');
    await safeDelete(pemetaanProfilKegiatan, 'pemetaanProfilKegiatan');
    await safeDelete(supportReplies, 'supportReplies');
    await safeDelete(profilKegiatan, 'profilKegiatan');
    await safeDelete(profilLembaga, 'profilLembaga');
    await safeDelete(profilKM, 'profilKM');
    await safeDelete(bestStaffLembaga, 'bestStaffLembaga');
    await safeDelete(bestStaffKegiatan, 'bestStaffKegiatan');
    await safeDelete(kehimpunan, 'kehimpunan');
    await safeDelete(notifications, 'notifications');
    await safeDelete(support, 'support');
    await safeDelete(associationRequestsLembaga, 'associationRequestsLembaga');
    await safeDelete(associationRequests, 'associationRequests');
    await safeDelete(keanggotaan, 'keanggotaan');
    await safeDelete(events, 'events');
    await safeDelete(lembaga, 'lembaga');
    await safeDelete(mahasiswa, 'mahasiswa');
    await safeDelete(sessions, 'sessions');
    await safeDelete(accounts, 'accounts');
    await safeDelete(verificationTokens, 'verificationTokens');
    await safeDelete(verifiedUsers, 'verifiedUsers');
    await safeDelete(users, 'users');

    console.log('✅ All existing tables cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}

clearAllTables()
  .then(() => {
    console.log('Database clearing completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database clearing failed:', error);
    process.exit(1);
  });

export { clearAllTables };
