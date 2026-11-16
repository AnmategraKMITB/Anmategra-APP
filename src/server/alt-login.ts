import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  and,
  count,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
} from 'drizzle-orm';
import { db } from '~/server/db';
import { altLoginClaim, mahasiswa, users } from '~/server/db/schema';
import { insertMahasiswa, profileFromNim } from '~/server/mahasiswa-record';

type Database = typeof db;

/**
 * Akses alternatif untuk mahasiswa yang akun ITB-nya bermasalah (mis.
 * Microsoft Authenticator rusak). Sesinya hanya boleh mengisi form dan
 * kedaluwarsa cepat; login Microsoft yang berhasil mencabutnya.
 *
 * Email kontak yang diketik pemohon TIDAK diverifikasi, jadi sesi diikat ke
 * rahasia acak milik klaim (hanya hash-nya di basis data), bukan ke email.
 */
export const ALT_CLAIM_TTL_MS = 6 * 60 * 60 * 1000;
export const KTM_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Klaim bersengketa menunggu admin paling lama selama ini. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CLAIMS_PER_EMAIL = 3;
const MAX_CLAIMS_PER_IP_PER_HOUR = 10;

export type AltClaimErrorCode =
  | 'nim_invalid'
  | 'ktm_missing'
  | 'rate_email'
  | 'rate_ip'
  | 'akun_khusus';

export class AltClaimError extends Error {
  constructor(
    public readonly code: AltClaimErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AltClaimError';
  }
}

export function isValidNim(value: string): boolean {
  return /^\d{8}$/.test(value);
}

export function canonicalEmail(nim: string): string {
  return `${nim}@mahasiswa.itb.ac.id`;
}

export type AltAccess =
  | {
      kind: 'claim';
      claimId: string;
      userId: string;
      nim: number;
      expiresAt: Date;
    }
  /** Klaim bersengketa yang menunggu persetujuan admin; belum boleh apa pun. */
  | { kind: 'pending' }
  | { kind: 'guest' };

/** Klaim biasa langsung berlaku; klaim bersengketa baru berlaku setelah disetujui. */
function isHeld(claim: { disputed: boolean; approvedAt: Date | null }) {
  return claim.disputed && !claim.approvedAt;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Memeriksa rahasia klaim saat masuk; `null` bila salah atau klaim sudah dicabut. */
export async function verifyClaimSecret(
  claimId: string,
  secret: string,
  database: Database = db,
) {
  if (!claimId || !secret) return null;
  const [claim] = await database
    .select({
      id: altLoginClaim.id,
      contactEmail: altLoginClaim.contactEmail,
      secretHash: altLoginClaim.secretHash,
      revokedAt: altLoginClaim.revokedAt,
    })
    .from(altLoginClaim)
    .where(eq(altLoginClaim.id, claimId))
    .limit(1);
  if (!claim || claim.revokedAt) return null;
  const given = Buffer.from(hashSecret(secret), 'hex');
  const stored = Buffer.from(claim.secretHash, 'hex');
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
    return null;
  }
  return { id: claim.id, contactEmail: claim.contactEmail };
}

/** Status klaim milik sesi ini; dibaca ulang di setiap request. */
export async function resolveAltAccess(
  claimId: string,
  database: Database = db,
): Promise<AltAccess> {
  const [claim] = await database
    .select({
      id: altLoginClaim.id,
      userId: altLoginClaim.userId,
      nim: altLoginClaim.nim,
      expiresAt: altLoginClaim.expiresAt,
      disputed: altLoginClaim.disputed,
      approvedAt: altLoginClaim.approvedAt,
      revokedAt: altLoginClaim.revokedAt,
    })
    .from(altLoginClaim)
    .where(eq(altLoginClaim.id, claimId))
    .limit(1);
  if (!claim || claim.revokedAt || claim.expiresAt <= new Date()) {
    return { kind: 'guest' };
  }
  if (isHeld(claim)) return { kind: 'pending' };
  return {
    kind: 'claim',
    claimId: claim.id,
    userId: claim.userId,
    nim: claim.nim,
    expiresAt: claim.expiresAt,
  };
}

/** Hapus tautan KTM yang sudah lewat masa simpan; hanya jejak klaim yang tersisa. */
export async function purgeExpiredKtm(database: Database = db) {
  await database
    .update(altLoginClaim)
    .set({ ktm: null })
    .where(
      and(
        isNotNull(altLoginClaim.ktm),
        lt(altLoginClaim.created_at, new Date(Date.now() - KTM_RETENTION_MS)),
      ),
    );
}

async function resolveTargetUser(
  nim: string,
  googleName: string | null,
  database: Database,
): Promise<string> {
  const nimInt = parseInt(nim);
  const [byNim] = await database
    .select({
      userId: mahasiswa.userId,
      role: users.role,
      isDemo: users.isDemo,
    })
    .from(mahasiswa)
    .innerJoin(users, eq(users.id, mahasiswa.userId))
    .where(eq(mahasiswa.nim, nimInt))
    .limit(1);
  if (byNim) {
    assertPlainStudent(byNim);
    return byNim.userId;
  }

  // NIM belum pernah login: pakai email kanonik dari NIM supaya login
  // Microsoft nanti masuk ke akun yang sama, bukan akun ganda.
  const email = canonicalEmail(nim);
  let [user] = await database
    .select({ id: users.id, role: users.role, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (user) {
    assertPlainStudent(user);
  } else {
    await database
      .insert(users)
      .values({
        email,
        name: googleName,
        role: 'mahasiswa',
        // Dikosongkan agar login Microsoft pertama mengisi nama aslinya.
        emailVerified: null,
      })
      .onConflictDoNothing();
    [user] = await database
      .select({ id: users.id, role: users.role, isDemo: users.isDemo })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  }
  if (!user) throw new Error('Akun mahasiswa gagal dibuat.');
  const { jurusan, angkatan } = profileFromNim(nimInt);
  await insertMahasiswa(user.id, nimInt, jurusan, angkatan, database);
  return user.id;
}

function assertPlainStudent(user: { role: string; isDemo: boolean }) {
  if (user.role !== 'mahasiswa' || user.isDemo) {
    throw new AltClaimError(
      'akun_khusus',
      'NIM ini tidak bisa memakai jalur alternatif. Hubungi narahubung Anmategra.',
    );
  }
}

export type CreateAltClaimInput = {
  contactEmail: string;
  nim: string;
  ktm: Record<string, unknown> | null;
  ip: string | null;
  /** Klaim milik sesi pengaju sendiri (perpanjangan); tidak dihitung sebagai saingan. */
  ownClaimId?: string | null;
};

export async function createAltClaim(
  input: CreateAltClaimInput,
  database: Database = db,
) {
  const contactEmail = input.contactEmail.trim().toLowerCase();
  if (!isValidNim(input.nim)) {
    throw new AltClaimError('nim_invalid', 'NIM harus 8 digit angka.');
  }
  if (!input.ktm) {
    throw new AltClaimError('ktm_missing', 'Unggah foto KTM terlebih dahulu.');
  }

  await purgeExpiredKtm(database);

  const now = new Date();
  const [perEmail] = await database
    .select({ n: count() })
    .from(altLoginClaim)
    .where(
      and(
        eq(altLoginClaim.contactEmail, contactEmail),
        gt(altLoginClaim.created_at, new Date(now.getTime() - 24 * 3600_000)),
      ),
    );
  if ((perEmail?.n ?? 0) >= MAX_CLAIMS_PER_EMAIL) {
    throw new AltClaimError(
      'rate_email',
      'Terlalu banyak pengajuan dengan email ini hari ini. Coba lagi besok atau hubungi narahubung.',
    );
  }
  if (input.ip) {
    const [perIp] = await database
      .select({ n: count() })
      .from(altLoginClaim)
      .where(
        and(
          eq(altLoginClaim.ip, input.ip),
          gt(altLoginClaim.created_at, new Date(now.getTime() - 3600_000)),
        ),
      );
    if ((perIp?.n ?? 0) >= MAX_CLAIMS_PER_IP_PER_HOUR) {
      throw new AltClaimError(
        'rate_ip',
        'Terlalu banyak pengajuan dari jaringan ini. Coba lagi sebentar lagi.',
      );
    }
  }

  const userId = await resolveTargetUser(input.nim, null, database);
  const nimInt = parseInt(input.nim);

  // Perpanjangan: klaim lama milik sesi ini digantikan. Hanya sesi yang
  // memegang rahasia klaim itu yang bisa melakukannya.
  if (input.ownClaimId) {
    await database
      .update(altLoginClaim)
      .set({ revokedAt: now, revokedReason: 'diganti-klaim-baru' })
      .where(
        and(
          eq(altLoginClaim.id, input.ownClaimId),
          isNull(altLoginClaim.revokedAt),
        ),
      );
  }

  // NIM yang sama diklaim pihak lain dalam 24 jam terakhir (dan belum dicabut):
  // sengketa. Email tidak dipakai untuk membedakan pihak karena tidak
  // diverifikasi. Semua pihak ditahan sampai admin memutuskan, kecuali klaim
  // yang sudah pernah disetujui admin.
  const windowStart = new Date(now.getTime() - DISPUTE_WINDOW_MS);
  const rivals = await database
    .select({ id: altLoginClaim.id })
    .from(altLoginClaim)
    .where(
      and(
        eq(altLoginClaim.nim, nimInt),
        isNull(altLoginClaim.revokedAt),
        gt(altLoginClaim.created_at, windowStart),
      ),
    );
  const disputed = rivals.length > 0;
  if (disputed) {
    await database
      .update(altLoginClaim)
      .set({ disputed: true })
      .where(
        and(
          eq(altLoginClaim.nim, nimInt),
          isNull(altLoginClaim.revokedAt),
          isNull(altLoginClaim.approvedAt),
          gt(altLoginClaim.created_at, windowStart),
        ),
      );
  }

  const secret = randomBytes(32).toString('base64url');
  const [claim] = await database
    .insert(altLoginClaim)
    .values({
      userId,
      nim: nimInt,
      contactEmail,
      secretHash: hashSecret(secret),
      ktm: input.ktm,
      ip: input.ip,
      disputed,
      expiresAt: new Date(
        now.getTime() + (disputed ? PENDING_TTL_MS : ALT_CLAIM_TTL_MS),
      ),
    })
    .returning();
  if (!claim) throw new Error('Klaim gagal disimpan.');
  return { claim, secret };
}

/** Cabut semua klaim aktif milik satu user (dipakai saat login Microsoft sukses). */
export async function revokeAltClaimsForUser(
  userId: string,
  reason: string,
  database: Database = db,
) {
  await database
    .update(altLoginClaim)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(
      and(eq(altLoginClaim.userId, userId), isNull(altLoginClaim.revokedAt)),
    );
}

/**
 * Admin menyetujui klaim bersengketa: masa 6 jam mulai dihitung dari sekarang
 * dan klaim saingan untuk NIM yang sama dicabut. Mengembalikan `null` bila
 * klaim tidak ada atau tidak lagi menunggu.
 */
export async function approveAltClaim(
  claimId: string,
  adminId: string,
  database: Database = db,
) {
  const now = new Date();
  const [claim] = await database
    .select()
    .from(altLoginClaim)
    .where(eq(altLoginClaim.id, claimId))
    .limit(1);
  if (
    !claim ||
    claim.revokedAt ||
    claim.approvedAt ||
    !claim.disputed ||
    claim.expiresAt <= now
  ) {
    return null;
  }
  await database
    .update(altLoginClaim)
    .set({
      approvedAt: now,
      approvedBy: adminId,
      expiresAt: new Date(now.getTime() + ALT_CLAIM_TTL_MS),
    })
    .where(eq(altLoginClaim.id, claim.id));
  await database
    .update(altLoginClaim)
    .set({ revokedAt: now, revokedReason: 'sengketa-kalah', revokedBy: adminId })
    .where(
      and(
        eq(altLoginClaim.nim, claim.nim),
        ne(altLoginClaim.id, claim.id),
        isNull(altLoginClaim.revokedAt),
        isNull(altLoginClaim.approvedAt),
      ),
    );
  return claim;
}
