import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { type TRPCError } from '@trpc/server';

/**
 * Entri log galat tRPC yang aman untuk produksi: hanya path, kode, status,
 * jenis, dan durasi. Sengaja tanpa `error.message`, `cause`, `stack`, input,
 * header, atau token, karena bisa memuat data pribadi (mis. isi input yang
 * gagal validasi atau parameter query basis data).
 */
export type TrpcErrorLogEntry = {
  event: 'trpc_error';
  path: string;
  code: TRPCError['code'];
  httpStatus: number;
  type: string;
  durationMs: number;
};

export function buildTrpcErrorLog(opts: {
  path: string | undefined;
  type: string;
  error: TRPCError;
  startedAt: number;
  now?: number;
}): TrpcErrorLogEntry {
  return {
    event: 'trpc_error',
    path: opts.path ?? '<no-path>',
    code: opts.error.code,
    httpStatus: getHTTPStatusCodeFromError(opts.error),
    type: opts.type,
    durationMs: Math.max(0, (opts.now ?? Date.now()) - opts.startedAt),
  };
}

/** Galat server (5xx) dicatat sebagai error, galat klien (4xx) sebagai warn. */
export function logTrpcError(entry: TrpcErrorLogEntry) {
  const line = JSON.stringify(entry);
  if (entry.httpStatus >= 500) console.error(line);
  else console.warn(line);
}
