import { TRPCError } from '@trpc/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildTrpcErrorLog, logTrpcError } from './log-error';

afterEach(() => vi.restoreAllMocks());

describe('buildTrpcErrorLog', () => {
  it('memuat path, kode, status, jenis, dan durasi', () => {
    const entry = buildTrpcErrorLog({
      path: 'form.submit',
      type: 'mutation',
      error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'x' }),
      startedAt: 1000,
      now: 1250,
    });
    expect(entry).toEqual({
      event: 'trpc_error',
      path: 'form.submit',
      code: 'INTERNAL_SERVER_ERROR',
      httpStatus: 500,
      type: 'mutation',
      durationMs: 250,
    });
  });

  it('tidak membocorkan pesan, cause, atau stack', () => {
    const error = new TRPCError({
      code: 'BAD_REQUEST',
      message: 'email budi@example.com tidak valid',
      cause: new Error('token=abc.def.ghi'),
    });
    const text = JSON.stringify(
      buildTrpcErrorLog({ path: 'a.b', type: 'query', error, startedAt: 0, now: 1 }),
    );
    expect(text).not.toContain('budi@example.com');
    expect(text).not.toContain('abc.def.ghi');
    expect(text).not.toContain('stack');
  });

  it('path kosong dan durasi tidak negatif', () => {
    const entry = buildTrpcErrorLog({
      path: undefined,
      type: 'unknown',
      error: new TRPCError({ code: 'NOT_FOUND' }),
      startedAt: 10,
      now: 5,
    });
    expect(entry.path).toBe('<no-path>');
    expect(entry.durationMs).toBe(0);
    expect(entry.httpStatus).toBe(404);
  });
});

describe('logTrpcError', () => {
  const base = {
    event: 'trpc_error' as const,
    path: 'a.b',
    type: 'query',
    durationMs: 1,
  };

  it('5xx lewat console.error, 4xx lewat console.warn', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logTrpcError({ ...base, code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 });
    logTrpcError({ ...base, code: 'UNAUTHORIZED', httpStatus: 401 });
    expect(err).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(err.mock.calls[0]![0] as string)).toMatchObject({
      path: 'a.b',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
