import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq } from 'drizzle-orm';
import { cache } from 'react';
import {
  type DefaultSession,
  type NextAuthOptions,
  getServerSession,
} from 'next-auth';
import { type Adapter } from 'next-auth/adapters';
import type { DefaultJWT } from 'next-auth/jwt';
import AzureADProvider from 'next-auth/providers/azure-ad';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { env } from '~/env';
import { db } from '~/server/db';
import {
  accounts,
  lembaga,
  mahasiswa,
  sessions,
  users,
  verificationTokens,
  verifiedUsers,
} from '~/server/db/schema';
import {
  resolveAltAccess,
  revokeAltClaimsForUser,
  verifyClaimSecret,
} from '~/server/alt-login';
import { insertMahasiswa, profileFromNim } from '~/server/mahasiswa-record';

import {
  clearDemoLoginFailures,
  isDemoLoginRateLimited,
  recordDemoLoginFailure,
  verifyDemoPassword,
} from './demo-auth';

export interface Prodi {
  kode: number;
  jurusan: string;
}

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      image: string;
      role: 'admin' | 'lembaga' | 'mahasiswa';
      lembagaId?: string;
      /**
       * Sesi akses alternatif (email + NIM + KTM). `guest` = klaim sudah habis,
       * dicabut, atau menunggu admin; `claim` = boleh mengisi form saja.
       */
      alt?: 'guest' | 'claim';
      altExpiresAt?: string;
      /** Klaim milik sesi ini; dipakai untuk memperpanjang tanpa dianggap saingan. */
      altClaimId?: string;
      /** Klaim bersengketa menunggu persetujuan admin. */
      altPending?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    image?: string;
    role: 'admin' | 'lembaga' | 'mahasiswa';
    lembagaId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    picture: string;
    role: 'admin' | 'lembaga' | 'mahasiswa';
    lembagaId?: string;
    /** Klaim akses alternatif milik sesi ini; statusnya dibaca ulang tiap request. */
    altClaimId?: string;
    alt?: 'guest' | 'claim';
    altExpiresAt?: string;
    altPending?: boolean;
  }
}

interface AzureADProfile {
  /** Directory (tenant) penerbit token; akun ITB = AZURE_AD_TENANT_ID. */
  tid: string;
  oid: string;
  name: string;
  email: string;
  preferred_username: string;
  sub: string;
  nickname: string;
  picture: string;
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    jwt: async ({ token, user, account }) => {
      const isDemo = env.APP_ENV === 'demo';

      // Akses alternatif: identitas efektif dihitung ulang dari basis data di
      // setiap pemanggilan, jadi klaim yang dicabut atau kedaluwarsa langsung
      // berhenti berlaku. Allowlist superadmin sengaja tidak berlaku di sini.
      if (account?.provider === 'alt-claim' && user) {
        token.altClaimId = user.id;
        token.name = user.name;
      }
      if (token.altClaimId) {
        const access = await resolveAltAccess(token.altClaimId);
        token.lembagaId = undefined;
        token.picture = '/images/placeholder/profile-pic.png';
        token.altPending = access.kind === 'pending';
        token.role = 'mahasiswa';
        if (access.kind === 'claim') {
          token.id = access.userId;
          token.alt = 'claim';
          token.altExpiresAt = access.expiresAt.toISOString();
        } else {
          token.id = `alt-guest:${token.altClaimId}`;
          token.alt = 'guest';
          token.altExpiresAt = undefined;
        }
        return token;
      }

      // Initial token on first sign in
      if (user) {
        // jwt only returns user on sign in, otherwise it's undefined

        // insert mahasiswa table
        if (account?.provider === 'azure-ad') {
          const nim = user.email.split('@')[0];
          const { jurusan, angkatan } = profileFromNim(parseInt(nim!));

          // Check if mahasiswa record already exists (from add manual)
          const existingMahasiswa = await db.query.mahasiswa.findFirst({
            where: eq(mahasiswa.userId, user.id),
          });

          if (!existingMahasiswa) {
            // Only insert if not added manually
            await insertMahasiswa(user.id, parseInt(nim!), jurusan, angkatan);
          }

          // Pemilik asli berhasil masuk lewat Microsoft: akses alternatif apa
          // pun atas akun ini langsung dicabut.
          await revokeAltClaimsForUser(user.id, 'login-microsoft');

          token.role = user.role;
        }

        // insert Lembaga table
        else if (account?.provider === 'google') {
          const userRecord = await db.query.users.findFirst({
            where: eq(users.email, user.email),
          });
          if (userRecord?.role === 'admin') {
            token.role = 'admin';
          } else {
            const lembagaExists = await db.query.lembaga.findFirst({
              where: eq(lembaga.userId, user.id),
            });
            if (!lembagaExists) {
              await db
                .update(users)
                .set({ role: 'lembaga' })
                .where(eq(users.id, user.id))
                .returning();
              const lembaga_id = crypto.randomUUID();
              await db
                .insert(lembaga)
                .values({
                  id: lembaga_id,
                  userId: user.id,
                  name: user.name,
                  foundingDate: new Date(),
                })
                .returning();

              token.role = 'lembaga';
              token.lembagaId = lembaga_id;
            } else {
              token.role = user.role;
              token.lembagaId = lembagaExists.id;
            }
          }
        }

        else if (account?.provider === 'credentials' && isDemo) {
          token.role = user.role;
          token.lembagaId = user.lembagaId;
        }

        token.id = user.id;
        token.picture = user.image ?? '/images/placeholder/profile-pic.png';
      }

      // Allowlist superadmin berlaku untuk semua provider, termasuk demo.
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (email && env.SUPERADMIN_EMAILS.includes(email)) {
        token.role = 'admin';
      }
      return token;
    },

    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.image = token.picture;
      session.user.role = token.role;
      session.user.lembagaId = token.lembagaId;
      session.user.alt = token.alt;
      session.user.altExpiresAt = token.altExpiresAt;
      session.user.altPending = token.altPending;
      session.user.altClaimId = token.altClaimId;
      return session;
    },

    signIn: async ({ user, account, profile }) => {
      if (account?.provider === 'credentials') {
        return env.APP_ENV === 'demo';
      }

      // Rahasia klaim sudah diverifikasi di authorize(); statusnya diperiksa di jwt.
      if (account?.provider === 'alt-claim') return true;

      // Akun demo tidak boleh masuk lewat SSO produksi.
      if (env.APP_ENV !== 'demo' && user.email) {
        const demoAccount = await db.query.users.findFirst({
          where: and(eq(users.email, user.email), eq(users.isDemo, true)),
        });
        if (demoAccount) return false;
      }

      // signin lembaga
      if (account?.provider === 'google') {
        const isValidLembaga = user.email?.endsWith('@km.itb.ac.id');
        const isVerified = await isEmailInVerifiedUsers(user.email);
        const userRecord = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });
        if (!isValidLembaga && !isVerified && userRecord?.role !== 'admin') return false;
      }
      // signin mahasiswa
      else if (account?.provider === 'azure-ad') {
        // Token harus diterbitkan directory ITB. Tanpa cek ini, akun dari tenant
        // Microsoft mana pun bisa lolos asal klaim email-nya berakhiran
        // @mahasiswa.itb.ac.id, padahal klaim itu bisa diisi bebas oleh admin
        // tenant lain.
        const tid = (profile as AzureADProfile | undefined)?.tid;
        if (tid !== env.AZURE_AD_TENANT_ID) return false;
        // cek email mahasiswa
        if (!user.email?.endsWith('@mahasiswa.itb.ac.id')) return false;
        // cek nim valid
        const nim = user.email.split('@')[0];
        if (!nim || nim.length !== 8 || isNaN(parseInt(nim))) return false;
      } else {
        return true;
      }

      const existingUser = await db.query.users.findFirst({
        where: (u) => eq(u.email, user.email),
      });

      if (existingUser) {
        // Check if account row already exists
        const existingAccount = await db.query.accounts.findFirst({
          where: (a) =>
            and(
              eq(a.provider, account.provider),
              eq(a.providerAccountId, account.providerAccountId),
            ),
        });

        if (!existingAccount) {
          // Insert new account entry
          await db.insert(accounts).values({
            userId: existingUser.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: 'oauth',
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            id_token: account.id_token,
          });
        }

        // Update emailVerified and name if user was added manually
        if (account.provider === 'azure-ad' && !existingUser.emailVerified) {
          await db
            .update(users)
            .set({
              emailVerified: new Date(),
              name: user.name,
            })
            .where(eq(users.id, existingUser.id));
        }

        user.id = existingUser.id;
        user.role =
          (existingUser.role as 'admin' | 'lembaga' | 'mahasiswa') ?? user.role;

        return true;
      }

      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  pages: {
    error: '/auth-error',
  },
  providers: [
    ...(env.APP_ENV === 'demo'
      ? [
          CredentialsProvider({
            id: 'credentials',
            name: 'Demo',
            credentials: {
              email: { label: 'Email', type: 'email' },
              password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
              const email = (credentials?.email ?? '').trim().toLowerCase();
              const password = credentials?.password ?? '';
              if (!email || !password || isDemoLoginRateLimited(email)) {
                return null;
              }
              const row = await db.query.users.findFirst({
                where: eq(users.email, email),
              });
              if (!row?.isDemo) {
                recordDemoLoginFailure(email);
                return null;
              }
              const valid = await verifyDemoPassword(
                password,
                env.DEMO_PASSWORD_HASH,
              );
              if (!valid) {
                recordDemoLoginFailure(email);
                return null;
              }
              clearDemoLoginFailures(email);
              const lembagaRow = await db.query.lembaga.findFirst({
                where: eq(lembaga.userId, row.id),
              });
              return {
                id: row.id,
                name: row.name ?? email,
                email: row.email,
                image: row.image ?? undefined,
                role: row.role,
                lembagaId: lembagaRow?.id,
              };
            },
          }),
        ]
      : []),
    // Jalur alternatif mahasiswa: masuk dengan id + rahasia klaim yang baru
    // dibuat di server. Tidak membuat user; hak akses datang dari klaim di
    // tabel alt_login_claim.
    CredentialsProvider({
      id: 'alt-claim',
      name: 'Akses alternatif',
      credentials: {
        claimId: { type: 'text' },
        secret: { type: 'text' },
      },
      async authorize(credentials) {
        const claim = await verifyClaimSecret(
          credentials?.claimId ?? '',
          credentials?.secret ?? '',
        );
        if (!claim) return null;
        return {
          id: claim.id,
          name: claim.contactEmail,
          email: claim.contactEmail,
          role: 'mahasiswa' as const,
        };
      },
    }),
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    AzureADProvider<AzureADProfile>({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      // Pakai endpoint directory ITB, bukan /common, supaya hanya token dari
      // tenant ITB yang lolos validasi issuer.
      tenantId: env.AZURE_AD_TENANT_ID,

      profile: (profile: AzureADProfile) => {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.preferred_username ?? profile.email,
          image: undefined,
          role: 'mahasiswa' as const,
        };
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
};

const isEmailInVerifiedUsers = async (email: string) => {
  const user = await db.query.verifiedUsers.findFirst({
    where: eq(verifiedUsers.email, email),
  });

  return user !== undefined;
  ``;
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 *
 * Dibungkus `cache` supaya cookie sesi cukup didekripsi sekali per request walaupun dipanggil
 * dari banyak tempat (halaman, `generateMetadata`, konteks tRPC). Di luar render React
 * (misalnya route handler), `cache` tidak menyimpan apa-apa dan fungsi tetap dipanggil biasa.
 */
const getRawServerSession = cache(() => getServerSession(authOptions));

/**
 * Sesi mentah termasuk sesi akses alternatif (Google pribadi). Hanya untuk
 * pemanggil yang memang melayani pengisian form: konteks tRPC (yang menolak
 * prosedur tanpa penanda `alt`), halaman isi form, dan unggahan berkas jawaban.
 */
export const getServerAuthSessionWithAlt = getRawServerSession;

/**
 * Sesi untuk semua pemanggil lain. Sesi akses alternatif dianggap tidak login
 * di sini, sehingga halaman dan route API baru tertutup secara default.
 */
export const getServerAuthSession = cache(async () => {
  const session = await getRawServerSession();
  return session?.user.alt ? null : session;
});
