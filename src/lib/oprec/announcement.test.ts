import { describe, expect, it } from 'vitest';

import {
  NO_GROUP_LABEL,
  anchorSlugs,
  filterAnnouncement,
  groupAnnouncement,
  parseInviteUrl,
} from './announcement';

const row = (name: string, nim = 1) => ({
  name,
  nim,
  prodi: 'Informatika',
  angkatan: 2024,
});

describe('groupAnnouncement', () => {
  it('mengelompokkan per bidang lalu divisi mengikuti urutan oprec dan menyortir A-Z', () => {
    const result = groupAnnouncement(
      [
        { id: 'd1', label: 'Acara', groupLabel: 'Inti' },
        { id: 'd2', label: 'Humas', groupLabel: 'Eksternal' },
        { id: 'd3', label: 'Dana', groupLabel: 'Inti' },
      ],
      [
        { divisionId: 'd1', ...row('Budi') },
        { divisionId: 'd1', ...row('Ani') },
      ],
    );
    expect(result.map((s) => s.label)).toEqual(['Inti', 'Eksternal']);
    expect(result[0]!.divisions.map((d) => d.label)).toEqual(['Acara', 'Dana']);
    expect(result[0]!.divisions[0]!.rows.map((r) => r.name)).toEqual([
      'Ani',
      'Budi',
    ]);
  });

  it('divisi tanpa bidang masuk "Tanpa bidang" bila ada bidang lain', () => {
    const result = groupAnnouncement(
      [
        { id: 'd1', label: 'Acara', groupLabel: 'Inti' },
        { id: 'd2', label: 'Lepas', groupLabel: null },
      ],
      [],
    );
    expect(result.map((s) => s.label)).toEqual(['Inti', NO_GROUP_LABEL]);
  });

  it('menyembunyikan judul bidang bila semua divisi tanpa bidang', () => {
    const result = groupAnnouncement(
      [
        { id: 'd1', label: 'Acara', groupLabel: null },
        { id: 'd2', label: 'Humas', groupLabel: null },
      ],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBeNull();
  });

  it('mempertahankan divisi tanpa penerima', () => {
    const result = groupAnnouncement(
      [{ id: 'd1', label: 'Acara', groupLabel: null }],
      [],
    );
    expect(result[0]!.divisions[0]!.rows).toEqual([]);
  });

  it('oprec tanpa divisi menghasilkan satu kelompok tanpa judul', () => {
    const result = groupAnnouncement([], []);
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBeNull();
    expect(result[0]!.divisions).toHaveLength(1);
  });
});

describe('filterAnnouncement', () => {
  const sections = groupAnnouncement(
    [
      { id: 'd1', label: 'Acara', groupLabel: 'Inti' },
      { id: 'd2', label: 'Humas', groupLabel: 'Eksternal' },
    ],
    [
      { divisionId: 'd1', ...row('Ani Wijaya', 13524001) },
      { divisionId: 'd2', ...row('Budi Santoso', 13524002) },
    ],
  );

  it('tanpa kata kunci mengembalikan semua, termasuk divisi kosong', () => {
    const r = filterAnnouncement(sections, '  ');
    expect(r.count).toBe(2);
    expect(r.sections).toHaveLength(2);
  });

  it('menyaring nama tanpa peduli huruf besar dan menyembunyikan section kosong', () => {
    const r = filterAnnouncement(sections, 'budi');
    expect(r.count).toBe(1);
    expect(r.sections.map((s) => s.label)).toEqual(['Eksternal']);
  });

  it('menyaring NIM', () => {
    const r = filterAnnouncement(sections, '13524001');
    expect(r.sections[0]!.divisions[0]!.rows[0]!.name).toBe('Ani Wijaya');
  });
});

describe('anchorSlugs', () => {
  it('membentuk <bidang>-<divisi> dan memberi sufiks angka pada bentrok', () => {
    const slugs = anchorSlugs([
      {
        label: 'Inti',
        divisions: [{ label: 'Humas & PR' }, { label: 'Humas PR' }],
      },
      { label: null, divisions: [{ label: 'Acara' }] },
    ]);
    expect(slugs[0]).toEqual(['inti-humas-pr', 'inti-humas-pr-2']);
    expect(slugs[1]).toEqual(['acara']);
  });
});

describe('parseInviteUrl', () => {
  it.each([
    'https://chat.whatsapp.com/AbC123',
    'https://line.me/ti/g/abc',
    'https://lin.ee/xyz',
    'https://liff.line.me/1',
  ])('menerima %s', (u) => {
    expect(parseInviteUrl(u)).not.toBeNull();
  });
  it.each([
    'javascript:alert(1)',
    'http://chat.whatsapp.com/x',
    'https://evil.com/chat.whatsapp.com',
    'https://chat.whatsapp.com.evil.com/x',
    'https://u:p@line.me/x',
    'bukan url',
    '',
  ])('menolak %s', (u) => {
    expect(parseInviteUrl(u)).toBeNull();
  });
});
