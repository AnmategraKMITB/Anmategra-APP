import { describe, expect, it } from 'vitest';

import { assertDemoResetAllowed } from './guard';

const ok = {
  APP_ENV: 'demo',
  NEXT_PUBLIC_APP_ENV: 'demo',
  DATABASE_URL: 'postgresql://u:p@db.demo.anmategra.com:5432/anmategra_demo',
};

describe('assertDemoResetAllowed', () => {
  it('mengizinkan lingkungan demo', () => {
    expect(assertDemoResetAllowed(ok)).toEqual({
      host: 'db.demo.anmategra.com',
      database: 'anmategra_demo',
    });
  });

  it('mengizinkan database lokal', () => {
    expect(
      assertDemoResetAllowed({
        APP_ENV: 'demo',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/anmategra',
      }).host,
    ).toBe('localhost');
  });

  it.each(['production', 'development', '', undefined])(
    'menolak APP_ENV=%s',
    (appEnv) => {
      expect(() => assertDemoResetAllowed({ ...ok, APP_ENV: appEnv })).toThrow(
        /APP_ENV/,
      );
    },
  );

  it('menolak NEXT_PUBLIC_APP_ENV selain demo', () => {
    expect(() =>
      assertDemoResetAllowed({ ...ok, NEXT_PUBLIC_APP_ENV: 'production' }),
    ).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });

  it('menolak DATABASE_URL kosong atau rusak', () => {
    expect(() =>
      assertDemoResetAllowed({ ...ok, DATABASE_URL: undefined }),
    ).toThrow(/DATABASE_URL/);
    expect(() =>
      assertDemoResetAllowed({ ...ok, DATABASE_URL: 'bukan-url' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('menolak database produksi walau APP_ENV=demo', () => {
    expect(() =>
      assertDemoResetAllowed({
        ...ok,
        DATABASE_URL: 'postgresql://u:p@db.anmategra.com:5432/anmategra',
      }),
    ).toThrow(/bukan database demo/);
  });
});
