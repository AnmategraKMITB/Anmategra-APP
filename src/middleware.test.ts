import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getToken = vi.fn();
vi.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => getToken(...args) as unknown,
}));

import middleware, { config } from './middleware';

type Result = { kind: 'next' } | { kind: 'redirect'; to: string };

async function run(path: string, token: { role: string } | null): Promise<Result> {
  getToken.mockResolvedValue(token);
  const res = await middleware(new NextRequest(`https://app.test${path}`));
  const location = res.headers.get('location');
  if (location) {
    const url = new URL(location);
    return { kind: 'redirect', to: url.pathname + url.search };
  }
  return { kind: 'next' };
}

beforeEach(() => {
  getToken.mockReset();
});

describe('/prototype/*', () => {
  it.each(['/prototype', '/prototype/oprec', '/prototype/oprec/forms'])(
    'tanpa login %s dialihkan ke halaman login',
    async (path) => {
      expect(await run(path, null)).toEqual({
        kind: 'redirect',
        to: '/authentication',
      });
    },
  );

  it('dengan login dilewatkan tanpa prefiks role', async () => {
    expect(await run('/prototype/oprec', { role: 'mahasiswa' })).toEqual({
      kind: 'next',
    });
  });

  it('middleware berjalan untuk /prototype (tidak dikecualikan matcher)', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/prototype/oprec')).toBe(true);
  });
});

describe('regresi rute lain', () => {
  it('/manage tetap butuh login', async () => {
    expect(await run('/manage/kegiatan', null)).toEqual({
      kind: 'redirect',
      to: '/authentication',
    });
    expect(await run('/manage/kegiatan', { role: 'lembaga' })).toEqual({
      kind: 'next',
    });
  });

  it('/mahasiswa tanpa login dialihkan ke login', async () => {
    expect(await run('/mahasiswa', null)).toEqual({
      kind: 'redirect',
      to: '/authentication',
    });
  });

  it('tautan form tanpa login membawa callbackUrl', async () => {
    expect(await run('/forms/abc', null)).toEqual({
      kind: 'redirect',
      to: '/authentication?callbackUrl=%2Fforms%2Fabc',
    });
  });
});
