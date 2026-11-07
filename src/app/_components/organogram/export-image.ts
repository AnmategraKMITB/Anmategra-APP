import { computeLevels } from '~/server/api/routers/organization/tree';

import {
  CANVAS_PAD,
  GROUP_H,
  NS_GAP,
  PERSON_H,
  SEAT_H,
  TITLE_LINE_H,
  TITLE_MAX_LINES,
  layoutChart,
  rowHeight,
} from './chart-layout';
import type { SeatRow } from './chart-layout';
import { unitTypeLabel } from './model';
import type { Draft, PlacementsByPosition, Unit } from './model';

export type ChartImageOptions = {
  /** Paling dalam yang ikut (1 = hanya bagian teratas). */
  depthLimit: number;
  showPeople: boolean;
  showPositions: boolean;
  expandGroups: boolean;
  showTitle: boolean;
};

/** Font web tidak ikut termuat di dalam SVG-sebagai-gambar, jadi pakai tumpukan sistem. */
const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

const FONT_XML = escapeXml(FONT);

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === 'undefined') {
    measureContext = null;
    return null;
  }
  measureContext = document.createElement('canvas').getContext('2d');
  return measureContext;
}

function measureText(text: string, fontPx: number, weight: number): number {
  const context = getMeasureContext();
  if (context === null) return text.length * fontPx * 0.56;
  context.font = `${weight} ${fontPx}px ${FONT}`;
  return context.measureText(text).width;
}

function ellipsize(
  text: string,
  maxWidth: number,
  fontPx: number,
  weight: number,
): string {
  if (maxWidth <= 0) return '';
  if (measureText(text, fontPx, weight) <= maxWidth) return text;
  const ellipsis = '…';
  if (measureText(ellipsis, fontPx, weight) > maxWidth) return '';
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (
      measureText(`${text.slice(0, mid)}${ellipsis}`, fontPx, weight) <=
      maxWidth
    ) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return `${text.slice(0, low).trimEnd()}${ellipsis}`;
}

function wrapLines(
  text: string,
  maxWidth: number,
  fontPx: number,
  weight: number,
  maxLines: number,
): string[] {
  const clean = text.trim();
  if (clean === '') return [''];

  const lines: string[] = [];
  let current = '';
  for (const word of clean.split(/\s+/)) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (measureText(candidate, fontPx, weight) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current !== '') lines.push(current);
    current = '';
    // Kata yang lebih lebar dari baris dipecah paksa.
    let rest = word;
    while (measureText(rest, fontPx, weight) > maxWidth && rest.length > 1) {
      let fit = rest.length - 1;
      while (
        fit > 1 &&
        measureText(rest.slice(0, fit), fontPx, weight) > maxWidth
      ) {
        fit -= 1;
      }
      lines.push(rest.slice(0, fit));
      rest = rest.slice(fit);
    }
    current = rest;
  }
  if (current !== '') lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(
    lines.slice(maxLines - 1).join(' '),
    maxWidth,
    fontPx,
    weight,
  );
  return kept;
}

function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const first = words[0]?.charAt(0) ?? '';
  const last =
    words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials === '' ? '?' : initials;
}

function pillColors(rankIndex: number): { bg: string; fg: string } {
  if (rankIndex === 0) return { bg: '#2B6282', fg: '#FFFFFF' };
  if (rankIndex === 1) return { bg: '#006E6E', fg: '#FFFFFF' };
  if (rankIndex === 2) return { bg: '#DFE7EC', fg: '#2B6282' };
  return { bg: '#E9EDF1', fg: '#141718' };
}

function text(x: number, y: number, content: string, attrs: string): string {
  return `<text x="${x}" y="${y}" ${attrs} font-family="${FONT_XML}">${escapeXml(content)}</text>`;
}

function avatar(
  cx: number,
  cy: number,
  r: number,
  name: string | null,
  fontPx: number,
  ring: boolean,
): string {
  const stroke = ring ? ' stroke="#FFFFFF" stroke-width="1.5"' : '';
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#DFE7EC"${stroke}/>` +
    text(
      cx,
      cy + fontPx * 0.35,
      initialsOf(name ?? ''),
      `text-anchor="middle" font-size="${fontPx}" font-weight="600" fill="#2B6282"`,
    )
  );
}

function drawRows(
  rows: SeatRow[],
  startY: number,
  x: number,
  w: number,
  tone: 'main' | 'ns',
  showPeople: boolean,
): string {
  const parts: string[] = [];
  let rowY = startY;

  for (const row of rows) {
    if (row.kind === 'seat') {
      const cy = rowY + SEAT_H / 2;
      if (!showPeople) {
        parts.push(
          text(
            x + 12,
            cy + 5,
            ellipsize(row.title, w - 24, 14, 400),
            'font-size="14" fill="#141718"',
          ),
        );
      } else if (row.person !== null) {
        // Nama dan pil berbagi lebar kartu: yang muat utuh tidak dipotong, sisanya dibagi.
        const nameFont = 13;
        const pillFont = 11;
        const name = row.person.name ?? 'Tanpa nama';
        const avail = w - 44 - 12 - 8;
        const nameNat = measureText(name, nameFont, 600);
        const pillNat = measureText(row.title, pillFont, 600) + 16;
        const pillW =
          nameNat + pillNat <= avail
            ? pillNat
            : Math.min(pillNat, Math.max(avail - nameNat, avail * 0.45));
        const pillX = x + w - 12 - pillW;
        const colors = pillColors(row.rankIndex);
        parts.push(avatar(x + 24, cy, 12, row.person.name, 10, false));
        parts.push(
          text(
            x + 44,
            cy + 4.5,
            ellipsize(name, pillX - 8 - (x + 44), nameFont, 600),
            `font-size="${nameFont}" font-weight="600" fill="#2B6282"`,
          ),
        );
        parts.push(
          `<rect x="${pillX}" y="${cy - 10}" width="${pillW}" height="20" rx="10" fill="${colors.bg}"/>`,
        );
        parts.push(
          text(
            pillX + pillW / 2,
            cy + 3.8,
            ellipsize(row.title, pillW - 12, pillFont, 600),
            `text-anchor="middle" font-size="${pillFont}" font-weight="600" fill="${colors.fg}"`,
          ),
        );
      } else {
        parts.push(
          `<circle cx="${x + 24}" cy="${cy}" r="11.5" fill="none" stroke="#9DA4A8" stroke-dasharray="3 3"/>`,
        );
        parts.push(
          text(
            x + 44,
            cy + 5,
            ellipsize(row.title, w - 12 - 44, 14, 400),
            'font-size="14" fill="#636A6D"',
          ),
        );
      }
    } else {
      const innerX = x + 8;
      const innerW = w - 16;
      const stroke =
        tone === 'ns'
          ? 'stroke="#1F8D44" stroke-opacity="0.4"'
          : 'stroke="#C4CACE"';
      parts.push(
        `<rect x="${innerX}" y="${rowY}" width="${innerW}" height="${rowHeight(row) - 4}" rx="8" fill="#FFFFFF" ${stroke}/>`,
      );

      const midY = rowY + (GROUP_H - 4) / 2;
      const count =
        row.quota === 0 ? `${row.filled} orang` : `${row.filled}/${row.quota}`;
      const countRight = innerX + innerW - 12;
      const countW = showPeople ? measureText(count, 12, 600) : 0;
      const avatarCount =
        showPeople && !row.expanded ? Math.min(3, row.people.length) : 0;
      const avatarsW = avatarCount > 0 ? 20 + (avatarCount - 1) * 14 + 8 : 0;
      const titleRight = countRight - (showPeople ? countW + 8 : 0) - avatarsW;

      parts.push(
        text(
          innerX + 12,
          midY + 5,
          ellipsize(row.title, titleRight - (innerX + 12), 14, 600),
          'font-size="14" font-weight="600" fill="#141718"',
        ),
      );

      if (showPeople) {
        parts.push(
          text(
            countRight,
            midY + 4,
            count,
            'text-anchor="end" font-size="12" font-weight="600" fill="#141718"',
          ),
        );
        if (!row.expanded) {
          const shown = row.people.slice(0, avatarCount);
          const lastCx = countRight - countW - 8 - 10;
          shown.forEach((person, i) => {
            const cx = lastCx - (shown.length - 1 - i) * 14;
            parts.push(avatar(cx, midY, 10, person.name, 9, true));
          });
        } else {
          row.people.forEach((person, i) => {
            const cy = rowY + GROUP_H + i * PERSON_H + PERSON_H / 2;
            parts.push(avatar(innerX + 22, cy, 10, person.name, 9, false));
            parts.push(
              text(
                innerX + 40,
                cy + 4.5,
                ellipsize(
                  person.name ?? 'Tanpa nama',
                  innerX + innerW - 12 - (innerX + 40),
                  13,
                  600,
                ),
                'font-size="13" font-weight="600" fill="#2B6282"',
              ),
            );
          });
        }
      }
    }
    rowY += rowHeight(row);
  }

  return parts.join('');
}

const TITLE_BAND = 64;

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildChartSvg(
  draft: Draft,
  placements: PlacementsByPosition,
  options: ChartImageOptions,
): { svg: string; width: number; height: number; nodeCount: number } {
  const levels = computeLevels(draft.units);
  const keptIds = new Set(
    draft.units
      .filter((unit) => (levels.get(unit.id) ?? 0) <= options.depthLimit)
      .map((unit) => unit.id),
  );
  const units: Unit[] = draft.units.filter((unit) => keptIds.has(unit.id));
  const positions = options.showPositions
    ? draft.positions.filter(
        (position) => keptIds.has(position.unitId) && !position.hidden,
      )
    : [];
  const pruned: Draft = { ...draft, units, positions };
  const expandedGroups = new Set(
    options.expandGroups ? positions.map((position) => position.id) : [],
  );

  const layout = layoutChart(pruned, placements, new Set(), expandedGroups);

  const band = options.showTitle ? TITLE_BAND : 0;
  const width = Math.round(layout.width);
  const height = Math.round(layout.height + band);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(draft.name)}">`,
    `<defs><marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#9DA4A8"/></marker></defs>`,
    `<rect width="${width}" height="${height}" fill="#FFFFFF"/>`,
  ];

  if (options.showTitle) {
    const date = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    parts.push(
      text(
        CANVAS_PAD,
        36,
        draft.name,
        'font-size="22" font-weight="700" fill="#141718"',
      ),
      text(
        CANVAS_PAD,
        54,
        `Dibuat dengan Anmategra · ${date}`,
        'font-size="12" fill="#636A6D"',
      ),
    );
  }

  parts.push(`<g transform="translate(0 ${band})">`);

  for (const edge of layout.edges) {
    parts.push(
      `<path d="${escapeXml(edge.d)}" fill="none" stroke="#9DA4A8" stroke-width="1.5" marker-end="url(#arrow)"/>`,
    );
  }

  for (const node of layout.nodes) {
    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.mainH}" rx="12" fill="#FFFFFF" stroke="#C4CACE"/>`,
    );

    // Jenis dan nama dalam satu kalimat ("Divisi General Affairs"), diletakkan di tengah header.
    const heading = wrapLines(
      `${unitTypeLabel(node.unit, node.depth, draft.levelLabels)} ${node.unit.name}`,
      node.w - 24,
      14,
      600,
      TITLE_MAX_LINES,
    );
    const top = node.y + (node.headerH - heading.length * TITLE_LINE_H) / 2;
    heading.forEach((line, i) => {
      parts.push(
        text(
          node.x + 12,
          top + 14 + i * TITLE_LINE_H,
          line,
          'font-size="14" font-weight="600" fill="#141718"',
        ),
      );
    });

    if (node.rows.length > 0) {
      parts.push(
        `<line x1="${node.x}" y1="${node.y + node.headerH}" x2="${node.x + node.w}" y2="${node.y + node.headerH}" stroke="#E9EDF1"/>`,
        drawRows(
          node.rows,
          node.y + node.headerH,
          node.x,
          node.w,
          'main',
          options.showPeople,
        ),
      );
    }

    if (node.nsRows.length > 0) {
      const nsY = node.y + node.mainH + NS_GAP;
      parts.push(
        `<rect x="${node.x}" y="${nsY}" width="${node.w}" height="${node.nsH}" rx="12" fill="#EAF8EF" stroke="#1F8D44" stroke-opacity="0.4"/>`,
        drawRows(
          node.nsRows,
          nsY + 4,
          node.x,
          node.w,
          'ns',
          options.showPeople,
        ),
      );
    }
  }

  parts.push('</g></svg>');
  return {
    svg: parts.join('\n'),
    width,
    height,
    nodeCount: layout.nodes.length,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error('waktu habis'));
    }, 12_000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('peramban menolak memuat SVG'));
    };
    image.src = src;
  });
}

/** Data URI dicoba dulu; blob: sebagai cadangan karena CSP tertentu memblokir salah satunya. */
async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  try {
    return await loadImage(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
  } catch {
    const url = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    );
    try {
      return await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const MAX_SIDE = 16_000;
const MAX_PIXELS = 100_000_000;

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale: number,
): Promise<Blob> {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const s = Math.min(
    scale,
    MAX_SIDE / w,
    MAX_SIDE / h,
    Math.sqrt(MAX_PIXELS / (w * h)),
  );
  const image = await loadSvgImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w * s));
  canvas.height = Math.max(1, Math.floor(h * s));
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('kanvas tidak tersedia');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('kanvas kosong'))),
      'image/png',
    );
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportFileStem(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'organogram' : slug;
}
