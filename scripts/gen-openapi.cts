/**
 * Generate docs/api/openapi.json from the tRPC router.
 *
 *   npm run docs:api
 *
 * tRPC is not REST, but its HTTP wire format is deterministic, so the whole
 * router can be described as OpenAPI without touching a single procedure:
 * queries are GET with a JSON-encoded `input` query param, mutations are POST
 * with a JSON body. superjson wraps both sides in a `{ json: ... }` envelope.
 *
 * Access levels come from the `access` meta set on the procedure builders in
 * `src/server/api/trpc.ts`. Human-written prose lives in
 * `docs/api/api-notes.json`, and hand-maintained REST endpoints (the Excel
 * import/export routes) live in `docs/api/rest-openapi.json`; both are merged
 * in here so nothing written by hand is lost on regeneration.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { appRouter } from '~/server/api/root';
import type { ApiMeta } from '~/server/api/trpc';

const OUT = path.join(process.cwd(), 'docs/api/openapi.json');
const NOTES = path.join(process.cwd(), 'docs/api/api-notes.json');
const REST = path.join(process.cwd(), 'docs/api/rest-openapi.json');

const BASE_PATH = '/api/trpc';

// Dibaca langsung dari package.json, bukan dari npm_package_version, supaya
// hasilnya sama baik lewat `npm run docs:api` maupun `npx tsx` langsung.
const pkg = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
) as { version?: string };

type ProcedureDef = {
  type: 'query' | 'mutation' | 'subscription';
  meta?: ApiMeta;
  inputs?: ZodTypeAny[];
  output?: ZodTypeAny;
};

type Note = { summary?: string; description?: string; deprecated?: boolean };

const ACCESS: Record<
  ApiMeta['access'],
  { label: string; description: string }
> = {
  public: {
    label: 'Public',
    description: 'Tidak butuh login.',
  },
  authenticated: {
    label: 'Authenticated',
    description: 'Butuh sesi login yang valid (role apa pun).',
  },
  admin: {
    label: 'Admin',
    description: 'Hanya untuk akun dengan `role = admin`.',
  },
  lembaga: {
    label: 'Lembaga (owner)',
    description:
      'Hanya untuk akun dengan `role = lembaga`. Akses dicek dari role saja, bukan dari `lembagaId` di input.',
  },
  'lembaga-scoped': {
    label: 'Owner / Admin Lembaga',
    description:
      'Butuh `lembagaId` di input. Boleh diakses Owner Lembaga tersebut atau akun yang di-grant sebagai Admin Lembaga.',
  },
  'lembaga-owner': {
    label: 'Owner Lembaga',
    description:
      'Butuh `lembagaId` di input. Hanya Owner Lembaga — Admin Lembaga ditolak.',
  },
  'event-scoped': {
    label: 'Owner / Admin Kepanitiaan',
    description:
      'Butuh `eventId` di input. Boleh diakses Owner/Admin lembaga induk, atau Admin Kepanitiaan yang di-grant untuk event tersebut.',
  },
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  admin: 'Operasi khusus admin sistem: verifikasi user, kelola data master.',
  adminGrant: 'Grant dan revoke Owner/Admin Lembaga & Kepanitiaan (RO-03).',
  event: 'CRUD kepanitiaan/kegiatan beserta anggotanya.',
  kegiatan: 'Query kegiatan dari sisi konsumen (listing, detail, pencarian).',
  landing: 'Data agregat untuk halaman publik/landing.',
  lembaga: 'CRUD lembaga (himpunan, UKM, BSO) beserta anggota dan strukturnya.',
  profil: 'Master Profil KM dan pemetaan profil lembaga/kegiatan.',
  profile: 'Halaman profil publik lembaga, kegiatan, dan mahasiswa.',
  rapor: 'Nilai profil dan rapor mahasiswa.',
  riwayat: 'Histori permanen keanggotaan lembaga dan kepanitiaan (H-03).',
  users: 'Akun dan data mahasiswa.',
  excel:
    'Endpoint REST (non-tRPC) untuk ekspor/impor anggota dan nilai lewat berkas Excel.',
};

function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T)
    : fallback;
}

/** superjson serialises every payload as `{ json, meta? }` on the wire. */
function superjsonEnvelope(schema: unknown) {
  return {
    type: 'object',
    required: ['json'],
    properties: {
      json: schema ?? {},
      meta: {
        type: 'object',
        description:
          'Metadata superjson untuk tipe non-JSON (Date, Map, dst). Opsional.',
      },
    },
  };
}

/**
 * zod-to-json-schema can emit a bare `nullable: true` (e.g. for a nullable
 * `z.any()`), which OpenAPI 3.0 rejects because `nullable` needs a sibling
 * `type`. Drop those; the field stays documented, just untyped.
 */
function stripDanglingNullable(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripDanglingNullable);
  if (!node || typeof node !== 'object') return node;

  const obj = node as Record<string, unknown>;
  const typed =
    'type' in obj ||
    '$ref' in obj ||
    'allOf' in obj ||
    'anyOf' in obj ||
    'oneOf' in obj;
  if ('nullable' in obj && !typed) delete obj.nullable;

  for (const [key, value] of Object.entries(obj))
    obj[key] = stripDanglingNullable(value);
  return obj;
}

function toJsonSchema(schema: ZodTypeAny | undefined, name: string) {
  if (!schema) return undefined;
  try {
    const json = zodToJsonSchema(schema, {
      target: 'openApi3',
      $refStrategy: 'none',
    }) as Record<string, unknown>;
    delete json.$schema;
    return stripDanglingNullable(json) as Record<string, unknown>;
  } catch (error) {
    console.warn(
      `[openapi] cannot convert schema for ${name}: ${String(error)}`,
    );
    return undefined;
  }
}

const procedures = (
  appRouter as unknown as {
    _def: { procedures: Record<string, { _def: ProcedureDef }> };
  }
)._def.procedures;

const notes = readJson<Record<string, Note>>(NOTES, {});
const rest = readJson<{
  paths?: Record<string, unknown>;
  components?: { schemas?: Record<string, unknown> };
}>(REST, {});

const paths: Record<string, Record<string, unknown>> = {};
const schemas: Record<string, unknown> = {
  TRPCError: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          json: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              code: { type: 'integer', description: 'Kode error JSON-RPC.' },
              data: {
                type: 'object',
                properties: {
                  code: {
                    type: 'string',
                    description:
                      'Kode tRPC, misal UNAUTHORIZED / FORBIDDEN / BAD_REQUEST.',
                  },
                  httpStatus: { type: 'integer' },
                  path: { type: 'string' },
                  zodError: {
                    type: 'object',
                    nullable: true,
                    description:
                      'Detail validasi Zod bila error berasal dari `.input()`.',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

function trpcError(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
      },
    },
  };
}

const tagSet = new Set<string>();
let skipped = 0;
const missingAccess: string[] = [];

for (const [procPath, procedure] of Object.entries(procedures).sort(
  ([a], [b]) => a.localeCompare(b),
)) {
  const def = procedure._def;
  if (def.type === 'subscription') {
    skipped += 1;
    continue;
  }

  // Tidak ada fallback di sini: procedure builder tanpa `.meta({ access })` akan
  // salah label, dan salah label akses lebih berbahaya daripada docs yang gagal
  // di-generate. Kumpulkan dulu semuanya supaya errornya menyebut semua yang bolong.
  const access = def.meta?.access;
  if (!access) {
    missingAccess.push(procPath);
    continue;
  }
  const info = ACCESS[access];
  const [tag = 'root'] = procPath.split('.');
  tagSet.add(tag);

  const operationId = procPath.replace(/\./g, '_');
  const note = notes[procPath] ?? {};

  const inputSchema = toJsonSchema(def.inputs?.[0], `${procPath} input`);
  const outputSchema = toJsonSchema(def.output, `${procPath} output`);

  if (inputSchema) schemas[`${operationId}_input`] = inputSchema;
  if (outputSchema) schemas[`${operationId}_output`] = outputSchema;

  const inputRef = inputSchema
    ? { $ref: `#/components/schemas/${operationId}_input` }
    : undefined;
  const outputRef = outputSchema
    ? { $ref: `#/components/schemas/${operationId}_output` }
    : {
        description:
          'Procedure ini tidak mendeklarasikan `.output()`, jadi bentuk responsnya belum terdokumentasi.',
      };

  const description = [
    note.description,
    `**Akses:** ${info.label} — ${info.description}`,
    def.output
      ? undefined
      : '> Procedure ini belum punya `.output()` schema, jadi respons di bawah hanya perkiraan bentuk envelope-nya.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const operation: Record<string, unknown> = {
    operationId,
    tags: [tag],
    summary: note.summary ?? procPath,
    description,
    deprecated: note.deprecated ?? undefined,
    security: access === 'public' ? [] : [{ sessionCookie: [] }],
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                result: {
                  type: 'object',
                  properties: { data: superjsonEnvelope(outputRef) },
                },
              },
            },
          },
        },
      },
      400: trpcError('Input gagal divalidasi Zod (`BAD_REQUEST`).'),
      ...(access === 'public'
        ? {}
        : {
            401: trpcError(
              'Belum login atau sesi kedaluwarsa (`UNAUTHORIZED`).',
            ),
            403: trpcError(
              `Sudah login tapi tidak memenuhi akses ${info.label} (\`FORBIDDEN\`).`,
            ),
          }),
      404: trpcError('Resource yang dirujuk tidak ditemukan (`NOT_FOUND`).'),
      default: {
        description: 'Error tRPC lain, termasuk `INTERNAL_SERVER_ERROR`.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/TRPCError' },
          },
        },
      },
    },
  };

  if (def.type === 'query') {
    if (inputRef) {
      // OpenAPI models a JSON-serialised query param via `content`, which is
      // exactly what tRPC does with `?input=`.
      operation.parameters = [
        {
          name: 'input',
          in: 'query',
          required: !def.inputs?.[0]?.isOptional?.(),
          description:
            'Input procedure, di-JSON-encode dengan envelope superjson.',
          content: {
            'application/json': { schema: superjsonEnvelope(inputRef) },
          },
        },
      ];
    }
  } else {
    operation.requestBody = {
      required: Boolean(inputRef),
      content: { 'application/json': { schema: superjsonEnvelope(inputRef) } },
    };
  }

  const url = `${BASE_PATH}/${procPath}`;
  paths[url] = {
    ...(paths[url] ?? {}),
    [def.type === 'query' ? 'get' : 'post']: operation,
  };
}

if (missingAccess.length > 0) {
  console.error(
    [
      `[openapi] ${missingAccess.length} procedure tanpa meta \`access\`:`,
      ...missingAccess.map((p) => `  - ${p}`),
      '',
      'Setiap procedure builder di src/server/api/trpc.ts harus memanggil',
      '`.meta({ access: ... })`. Tanpa itu level aksesnya tidak bisa didokumentasikan',
      'dan docs bisa menyebut endpoint privat sebagai publik (atau sebaliknya).',
    ].join('\n'),
  );
  process.exit(1);
}

// Tag dari overlay REST ikut didaftarkan supaya tidak muncul sebagai tag tanpa deskripsi.
for (const item of Object.values(rest.paths ?? {})) {
  for (const operation of Object.values(
    item as Record<string, { tags?: string[] }>,
  )) {
    for (const tag of operation?.tags ?? []) tagSet.add(tag);
  }
}

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Anmategra API',
    version: String(pkg.version ?? '0.0.0'),
    description: [
      'Dokumentasi endpoint Anmategra, di-generate dari router tRPC (`src/server/api/root.ts`).',
      '',
      '## Cara memanggil',
      '',
      'Semua procedure tRPC berada di bawah `/api/trpc/<router>.<procedure>`:',
      '',
      '- **Query** → `GET`, input dikirim lewat query param `input` yang berisi JSON.',
      '- **Mutation** → `POST`, input dikirim sebagai JSON body.',
      '',
      'Transformer-nya superjson, jadi input dan output selalu dibungkus `{ "json": ... }`.',
      'Contoh: `GET /api/trpc/lembaga.getById?input={"json":{"id":"..."}}` (URL-encode nilai `input`).',
      '',
      '## Autentikasi',
      '',
      'Autentikasi memakai session cookie NextAuth. Login lewat aplikasi dulu, lalu panggilan dari',
      'browser yang sama akan otomatis membawa cookie-nya.',
      '',
      '## Endpoint non-tRPC',
      '',
      'Endpoint impor/ekspor Excel di bawah tag `excel` adalah route REST biasa dan tidak memakai',
      'envelope superjson.',
    ].join('\n'),
    license: { name: 'UNLICENSED' },
  },
  // Server sengaja dibuat variabel, bukan dibaca dari env: outputnya harus
  // deterministik supaya `npm run docs:check` tidak gagal cuma karena beda env.
  servers: [
    {
      url: '{baseUrl}',
      description: 'Base URL aplikasi.',
      variables: {
        baseUrl: {
          default: 'http://localhost:3000',
          description: 'Ganti ke origin production saat mencoba dari Scalar.',
        },
      },
    },
  ],
  tags: [...tagSet].sort().map((name) => ({
    name,
    description: TAG_DESCRIPTIONS[name] ?? `Procedure di router \`${name}\`.`,
  })),
  paths: { ...paths, ...(rest.paths ?? {}) },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
        description:
          'Session cookie NextAuth. Di HTTPS namanya `__Secure-next-auth.session-token`.',
      },
    },
    schemas: { ...schemas, ...(rest.components?.schemas ?? {}) },
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(spec, null, 2)}\n`);

const total = Object.keys(procedures).length - skipped;
const undocumented = Object.entries(procedures).filter(
  ([, p]) => !p._def.output,
).length;
console.log(
  `[openapi] ${total} procedures + ${Object.keys(rest.paths ?? {}).length} REST paths -> ${path.relative(process.cwd(), OUT)}`,
);
if (undocumented > 0) {
  console.log(
    `[openapi] ${undocumented} procedures tanpa .output() schema — responsnya belum terdokumentasi.`,
  );
}
