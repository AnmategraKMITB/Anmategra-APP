/**
 * Pengelompokan dan pencarian daftar penerima pada halaman pengumuman hasil
 * oprec. Murni: tanpa DB, agar mudah diuji.
 */

export const NO_GROUP_LABEL = 'Tanpa bidang';

export type AnnouncementRow = {
  name: string;
  nim: number;
  prodi: string;
  angkatan: number;
};

export type AnnouncementDivision = {
  id: string;
  label: string;
  rows: AnnouncementRow[];
};

export type AnnouncementSection = {
  /** null = judul bidang disembunyikan. */
  label: string | null;
  divisions: AnnouncementDivision[];
};

const byName = (a: AnnouncementRow, b: AnnouncementRow) =>
  a.name.localeCompare(b.name, 'id') || a.nim - b.nim;

/**
 * `divisions` sudah berurutan menurut pengaturan oprec. Bidang disusun menurut
 * kemunculan pertamanya; divisi tanpa bidang masuk "Tanpa bidang" kecuali
 * semua divisi tanpa bidang (judul disembunyikan).
 */
export function groupAnnouncement(
  divisions: { id: string; label: string; groupLabel: string | null }[],
  rows: (AnnouncementRow & { divisionId: string })[],
): AnnouncementSection[] {
  if (divisions.length === 0) {
    return [{ label: null, divisions: [{ id: '', label: '', rows: [] }] }];
  }
  const allUngrouped = divisions.every((d) => d.groupLabel === null);
  const sections = new Map<string | null, AnnouncementSection>();
  for (const division of divisions) {
    const key = allUngrouped ? null : (division.groupLabel ?? NO_GROUP_LABEL);
    let section = sections.get(key);
    if (!section) {
      section = { label: key, divisions: [] };
      sections.set(key, section);
    }
    section.divisions.push({
      id: division.id,
      label: division.label,
      rows: rows
        .filter((r) => r.divisionId === division.id)
        .map(({ divisionId: _unused, ...rest }) => rest)
        .sort(byName),
    });
  }
  return [...sections.values()];
}

/** Menyaring nama dan NIM lintas semua section; section tanpa hasil disembunyikan saat mencari. */
export function filterAnnouncement(
  sections: AnnouncementSection[],
  query: string,
): { sections: AnnouncementSection[]; count: number } {
  const q = query.trim().toLowerCase();
  const total = (list: AnnouncementSection[]) =>
    list.reduce(
      (sum, s) => sum + s.divisions.reduce((n, d) => n + d.rows.length, 0),
      0,
    );
  if (q === '') return { sections, count: total(sections) };
  const filtered = sections
    .map((section) => ({
      ...section,
      divisions: section.divisions
        .map((division) => ({
          ...division,
          rows: division.rows.filter(
            (r) =>
              r.name.toLowerCase().includes(q) || String(r.nim).includes(q),
          ),
        }))
        .filter((division) => division.rows.length > 0),
    }))
    .filter((section) => section.divisions.length > 0);
  return { sections: filtered, count: total(filtered) };
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Anchor `<bidang>-<divisi>` per divisi; bentrok diberi sufiks angka. */
export function anchorSlugs(
  sections: { label: string | null; divisions: { label: string }[] }[],
): string[][] {
  const used = new Set<string>();
  return sections.map((section) =>
    section.divisions.map((division) => {
      const base =
        [section.label, division.label]
          .filter((part): part is string => Boolean(part))
          .map(slugify)
          .filter(Boolean)
          .join('-') || 'divisi';
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      used.add(slug);
      return slug;
    }),
  );
}
