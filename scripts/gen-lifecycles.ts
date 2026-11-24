/**
 * Generate docs/api/lifecycles.{json,md} from `src/lib/lifecycle`.
 *
 *   bun run docs:lifecycle
 *
 * The JSON is for agents and tooling (states, legal moves, which moves are
 * guarded and on what); the Markdown renders each lifecycle as a Mermaid state
 * diagram on GitHub. Both are checked by `bun run docs:check` in CI, so they
 * cannot drift from the declarations.
 */
import fs from 'node:fs';
import path from 'node:path';

import { toMermaid } from '../src/lib/lifecycle/describe';
import { LIFECYCLES } from '../src/lib/lifecycle/index';

const DIR = path.join(process.cwd(), 'docs/api');

fs.writeFileSync(
  path.join(DIR, 'lifecycles.json'),
  `${JSON.stringify(LIFECYCLES, null, 2)}\n`,
);

const sections = LIFECYCLES.map((lifecycle) =>
  [
    `## ${lifecycle.name}`,
    '',
    `Keadaan: ${lifecycle.states.map((s) => `\`${s}\``).join(', ')}.`,
    '',
    '```mermaid',
    toMermaid(lifecycle),
    '```',
  ].join('\n'),
);

fs.writeFileSync(
  path.join(DIR, 'lifecycles.md'),
  [
    '# Siklus hidup status',
    '',
    '<!-- Di-generate oleh `bun run docs:lifecycle` dari `src/lib/lifecycle`. Jangan disunting manual. -->',
    '',
    'Perpindahan status yang sah. Yang tidak tergambar ditolak server. Label',
    'pada panah adalah syarat yang diperiksa sebelum pindah; ditulis lewat',
    '`transition()` atau diperiksa lewat `assertMove()` di `src/server/api/lifecycle.ts`.',
    '',
    ...sections.flatMap((section) => [section, '']),
  ].join('\n'),
);

console.log(
  `[lifecycle] ${LIFECYCLES.length} lifecycles -> docs/api/lifecycles.{json,md}`,
);
