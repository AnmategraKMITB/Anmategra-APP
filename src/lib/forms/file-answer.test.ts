import { describe, expect, it } from 'vitest';

import {
  type FileAnswerItem,
  fileRuleProblem,
  mimeFromName,
} from './file-answer';

const item = (mime: string, name = 'foto'): FileAnswerItem => ({
  itemId: 'x',
  driveId: 'google-drive',
  name,
  size: 1024,
  mime,
  url: 'https://drive.google.com/file/d/x/view',
  scope: 'anyone',
  provider: 'google-drive',
});

describe('preset gambar', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('menerima %s', (mime) => {
    expect(fileRuleProblem([item(mime)], { preset: 'gambar' })).toBeNull();
  });

  it('menolak PDF dan GIF', () => {
    expect(
      fileRuleProblem([item('application/pdf')], { preset: 'gambar' }),
    ).toMatch(/Jenis berkas/);
    expect(fileRuleProblem([item('image/gif')], { preset: 'gambar' })).toMatch(
      /Jenis berkas/,
    );
  });

  it('menolak gambar pada preset pdf', () => {
    expect(fileRuleProblem([item('image/png')], { preset: 'pdf' })).toMatch(
      /Jenis berkas/,
    );
  });

  it('menolak ukuran di atas batas', () => {
    const big = { ...item('image/png'), size: 3 * 1024 * 1024 };
    expect(fileRuleProblem([big], { preset: 'gambar', maxSizeMb: 2 })).toMatch(
      /Ukuran/,
    );
  });

  it('menolak host selain yang diizinkan', () => {
    const bad = { ...item('image/png'), url: 'https://evil.example/x.png' };
    expect(fileRuleProblem([bad], { preset: 'gambar' })).toMatch(/tidak valid/);
  });

  it('mime dari ekstensi gambar saat browser tak melaporkannya', () => {
    expect(mimeFromName('Foto.JPG')).toBe('image/jpeg');
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromName('a.png')).toBe('image/png');
    expect(mimeFromName('a.webp')).toBe('image/webp');
  });
});
