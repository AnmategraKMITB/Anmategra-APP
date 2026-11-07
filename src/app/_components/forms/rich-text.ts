/**
 * Teks kaya untuk judul dan deskripsi pertanyaan: subset markdown kecil yang
 * disimpan sebagai teks biasa.
 *
 *   **tebal**  _miring_  ++garis bawah++  [teks](https://alamat)
 *
 * Sengaja bukan HTML: hasil parse berupa pohon node yang dirender ke elemen
 * React, tidak pernah lewat `dangerouslySetInnerHTML`, jadi tidak ada yang
 * perlu disanitasi. Hanya tautan http(s) yang menjadi tautan; selebihnya
 * dibiarkan sebagai teks. Penanda tak tertutup juga dibiarkan sebagai teks.
 */

export type RichMarks = { bold?: true; italic?: true; underline?: true };
export type RichNode =
  | ({ type: 'text'; text: string } & RichMarks)
  | { type: 'link'; href: string; children: RichNode[] };

type Mark = 'bold' | 'italic' | 'underline' | 'link';

const ESCAPABLE = new Set(['\\', '*', '_', '+', '[', ']', '(', ')']);
const URL_RE = /^https?:\/\/[^\s()]+$/i;
const WORD_RE = /[\p{L}\p{N}]/u;

const isWord = (ch: string | undefined) => ch !== undefined && WORD_RE.test(ch);
const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

function textNode(text: string, marks: RichMarks): RichNode {
  return {
    type: 'text',
    text,
    ...(marks.bold && { bold: true as const }),
    ...(marks.italic && { italic: true as const }),
    ...(marks.underline && { underline: true as const }),
  };
}

const sameMarks = (a: RichMarks, b: RichMarks) =>
  !!a.bold === !!b.bold &&
  !!a.italic === !!b.italic &&
  !!a.underline === !!b.underline;

function merge(nodes: RichNode[]): RichNode[] {
  const out: RichNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (
      node.type === 'text' &&
      last?.type === 'text' &&
      sameMarks(last, node)
    ) {
      last.text += node.text;
    } else {
      out.push(node);
    }
  }
  return out;
}

/** Index of the next unescaped `token` at or after `from`, or -1. */
function findClose(src: string, from: number, token: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\' && ESCAPABLE.has(src[j + 1] ?? '')) {
      j++;
      continue;
    }
    if (src.startsWith(token, j)) return j;
  }
  return -1;
}

/** Closing `_` of an italic run: after a non-space, before a non-word. */
function findItalicClose(src: string, from: number): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\' && ESCAPABLE.has(src[j + 1] ?? '')) {
      j++;
      continue;
    }
    if (
      src[j] === '_' &&
      j > from &&
      !isSpace(src[j - 1]) &&
      !isWord(src[j + 1])
    ) {
      return j;
    }
  }
  return -1;
}

function matchLink(
  src: string,
  i: number,
): { label: string; href: string; next: number } | null {
  const close = findClose(src, i + 1, ']');
  if (close <= i + 1 || src[close + 1] !== '(') return null;
  const end = src.indexOf(')', close + 2);
  if (end < 0) return null;
  const href = src.slice(close + 2, end);
  if (!URL_RE.test(href)) return null;
  return { label: src.slice(i + 1, close), href, next: end + 1 };
}

function parse(src: string, marks: RichMarks): RichNode[] {
  const out: RichNode[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(textNode(buf, marks));
    buf = '';
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;

    if (ch === '\\' && ESCAPABLE.has(src[i + 1] ?? '')) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    const pair = src.startsWith('**', i)
      ? '**'
      : src.startsWith('++', i)
        ? '++'
        : null;
    if (pair) {
      const end = findClose(src, i + 2, pair);
      if (end > i + 2) {
        flush();
        const mark =
          pair === '**'
            ? { bold: true as const }
            : { underline: true as const };
        out.push(...parse(src.slice(i + 2, end), { ...marks, ...mark }));
        i = end + 2;
        continue;
      }
    }

    if (
      ch === '_' &&
      !isWord(src[i - 1]) &&
      !isSpace(src[i + 1]) &&
      src[i + 1] !== '_'
    ) {
      const end = findItalicClose(src, i + 1);
      if (end > i + 1) {
        flush();
        out.push(...parse(src.slice(i + 1, end), { ...marks, italic: true }));
        i = end + 1;
        continue;
      }
    }

    if (ch === '[') {
      const link = matchLink(src, i);
      if (link) {
        flush();
        out.push({
          type: 'link',
          href: link.href,
          children: parse(link.label, marks),
        });
        i = link.next;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

export function parseRichText(src: string): RichNode[] {
  return merge(parse(src, {}));
}

function plain(nodes: RichNode[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.text : plain(n.children)))
    .join('');
}

/** The text without any marker, for places that cannot show formatting. */
export function richTextToPlain(src: string): string {
  return plain(parseRichText(src));
}

const TOKEN: Record<Exclude<Mark, 'link'>, string> = {
  bold: '**',
  italic: '_',
  underline: '++',
};

/**
 * Applies a mark to the selection of a text field and returns the new value
 * and selection. Applying the same mark to an already wrapped selection takes
 * it off again. With nothing selected the markers are inserted with the caret
 * between them.
 */
export function applyMark(
  value: string,
  start: number,
  end: number,
  mark: Mark,
  url?: string,
): { value: string; start: number; end: number } {
  const lo = Math.max(0, Math.min(start, end, value.length));
  const hi = Math.min(value.length, Math.max(start, end));
  const selected = value.slice(lo, hi);

  if (mark === 'link') {
    if (!url || !URL_RE.test(url)) return { value, start: lo, end: hi };
    const label = selected || 'tautan';
    return {
      value: `${value.slice(0, lo)}[${label}](${url})${value.slice(hi)}`,
      start: lo + 1,
      end: lo + 1 + label.length,
    };
  }

  const token = TOKEN[mark];
  if (lo === hi) {
    return {
      value: `${value.slice(0, lo)}${token}${token}${value.slice(hi)}`,
      start: lo + token.length,
      end: lo + token.length,
    };
  }
  if (
    value.slice(lo - token.length, lo) === token &&
    value.slice(hi, hi + token.length) === token
  ) {
    return {
      value: `${value.slice(0, lo - token.length)}${selected}${value.slice(hi + token.length)}`,
      start: lo - token.length,
      end: hi - token.length,
    };
  }
  return {
    value: `${value.slice(0, lo)}${token}${selected}${token}${value.slice(hi)}`,
    start: lo + token.length,
    end: hi + token.length,
  };
}
