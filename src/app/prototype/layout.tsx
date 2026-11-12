import { createHmac, timingSafeEqual } from 'crypto';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { type ReactNode } from 'react';
import { env } from '~/env';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { adminPermission } from '~/server/db/schema';

export const dynamic = 'force-dynamic';

const COOKIE = 'prototype_access';

// Nilai cookie = HMAC kata sandi; mengganti sandi atau NEXTAUTH_SECRET
// otomatis mencabut semua akses lama.
const token = (password: string) =>
  createHmac('sha256', process.env.NEXTAUTH_SECRET ?? 'dev')
    .update(`prototype:${password}`)
    .digest('hex');

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function unlock(formData: FormData) {
  'use server';
  const password = env.PROTOTYPE_PASSWORD;
  const input = formData.get('password');
  if (!password || typeof input !== 'string') return;
  if (!same(token(input), token(password))) return;
  (await cookies()).set(COOKIE, token(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/prototype',
    maxAge: 60 * 60 * 12,
  });
  revalidatePath('/prototype', 'layout');
}

async function allowed(): Promise<boolean> {
  const session = await getServerAuthSession();
  if (session?.user.role === 'admin') return true;
  if (session) {
    const row = await db.query.adminPermission.findFirst({
      where: and(
        eq(adminPermission.userId, session.user.id),
        isNull(adminPermission.revokedAt),
        or(
          isNull(adminPermission.expiresAt),
          sql`${adminPermission.expiresAt} > now()`,
        ),
      ),
      columns: { permissions: true },
    });
    if ((row?.permissions.length ?? 0) > 0) return true;
  }
  const password = env.PROTOTYPE_PASSWORD;
  const cookie = (await cookies()).get(COOKIE)?.value;
  return Boolean(password && cookie && same(cookie, token(password)));
}

export default async function PrototypeLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (await allowed()) return children;

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-sm place-content-center gap-4 px-4">
      <h1 className="text-xl font-semibold">Purwarupa internal</h1>
      <p className="text-sm text-neutral-700">
        Halaman ini hanya untuk tim. Masuk sebagai superadmin atau operator,
        atau masukkan kata sandi.
      </p>
      {env.PROTOTYPE_PASSWORD ? (
        <form action={unlock} className="grid gap-2">
          <label htmlFor="password" className="text-sm">
            Kata sandi
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="off"
            className="rounded-xl border px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-primary-600 px-3 py-2 text-white"
          >
            Buka
          </button>
        </form>
      ) : null}
    </main>
  );
}
