import { describe, expect, it } from 'vitest';

import { canDropReport } from './column-type';

describe('canDropReport', () => {
  it('pelapor hanya boleh mengurutkan Draf/Dilaporkan dan mengirim draf', () => {
    expect(canDropReport(false, 'Draft', 'Reported')).toBe(true);
    expect(canDropReport(false, 'Draft', 'Draft')).toBe(true);
    expect(canDropReport(false, 'Reported', 'Reported')).toBe(true);
    expect(canDropReport(false, 'Reported', 'In Progress')).toBe(false);
    expect(canDropReport(false, 'Resolved', 'Resolved')).toBe(false);
  });

  it('admin boleh maju dan melompat, tidak boleh mundur', () => {
    expect(canDropReport(true, 'Reported', 'Resolved')).toBe(true);
    expect(canDropReport(true, 'In Progress', 'In Progress')).toBe(true);
    expect(canDropReport(true, 'Resolved', 'Reported')).toBe(false);
    expect(canDropReport(true, 'In Progress', 'Draft')).toBe(false);
  });

  it('tanpa kolom asal atau tujuan ditolak', () => {
    expect(canDropReport(true, undefined, 'Draft')).toBe(false);
    expect(canDropReport(false, 'Draft', undefined)).toBe(false);
  });
});
