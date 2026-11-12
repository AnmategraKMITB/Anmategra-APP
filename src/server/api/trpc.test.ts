import { describe, expect, it } from 'vitest';

import {
  adminProcedure,
  createCallerFactory,
  createTRPCRouter,
  lembagaProcedure,
  mahasiswaProcedure,
  protectedProcedure,
} from './trpc';

const router = createTRPCRouter({
  authenticated: protectedProcedure.query(() => 'ok'),
  adminOnly: adminProcedure.query(() => 'ok'),
  lembagaOnly: lembagaProcedure.query(() => 'ok'),
  mahasiswaOnly: mahasiswaProcedure.query(() => 'ok'),
});

type Role = 'mahasiswa' | 'lembaga' | 'admin';
type Anyone = Role | 'anonim';

function callerFor(role: Anyone) {
  const session =
    role === 'anonim'
      ? null
      : { user: { id: 'u1', role, lembagaId: 'l1' }, expires: '' };
  // Guard hanya membaca `ctx.session`; basis data tidak tersentuh.
  return createCallerFactory(router)({
    db: {},
    session,
    headers: new Headers(),
  } as never);
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return (error as { code?: string }).code ?? 'ERROR';
  }
}

const ROLES: Anyone[] = ['anonim', 'mahasiswa', 'lembaga', 'admin'];

describe('guard peran pada prosedur tRPC', () => {
  // Belum login = 401; sudah login tetapi salah peran = 403.
  const expected: Record<
    'authenticated' | 'adminOnly' | 'lembagaOnly' | 'mahasiswaOnly',
    Record<Anyone, string>
  > = {
    authenticated: {
      anonim: 'UNAUTHORIZED',
      mahasiswa: 'OK',
      lembaga: 'OK',
      admin: 'OK',
    },
    adminOnly: {
      anonim: 'UNAUTHORIZED',
      mahasiswa: 'FORBIDDEN',
      lembaga: 'FORBIDDEN',
      admin: 'OK',
    },
    lembagaOnly: {
      anonim: 'UNAUTHORIZED',
      mahasiswa: 'FORBIDDEN',
      lembaga: 'OK',
      admin: 'FORBIDDEN',
    },
    mahasiswaOnly: {
      anonim: 'UNAUTHORIZED',
      mahasiswa: 'OK',
      lembaga: 'FORBIDDEN',
      admin: 'FORBIDDEN',
    },
  };

  for (const [procedure, byRole] of Object.entries(expected)) {
    for (const role of ROLES) {
      it(`${procedure} untuk ${role} -> ${byRole[role]}`, async () => {
        const caller = callerFor(role) as unknown as Record<
          string,
          () => Promise<unknown>
        >;
        expect(await codeOf(caller[procedure]!())).toBe(byRole[role]);
      });
    }
  }
});
