import { describe, expect, it } from 'vitest';

import {
  allTargetUnits,
  clampWeight,
  defaultPositionId,
  findAttachment,
  weightNote,
} from './helpers';

describe('clampWeight (K-05)', () => {
  it('menjepit ke 0-100 dan membulatkan', () => {
    expect(clampWeight('150')).toBe(100);
    expect(clampWeight(150)).toBe(100);
    expect(clampWeight('-5')).toBe(0);
    expect(clampWeight('33.6')).toBe(34);
    expect(clampWeight('')).toBe(0);
    expect(clampWeight('abc')).toBe(0);
    expect(clampWeight('100')).toBe(100);
  });
  it('memberi pesan hanya di luar batas', () => {
    expect(weightNote('150')).toMatch(/0 sampai 100/);
    expect(weightNote('50')).toBeNull();
  });
});

describe('allTargetUnits (M-04)', () => {
  const positions = [
    { id: 'p1', unitId: 'b1', rank: 'staff' },
    { id: 'p2', unitId: 'd1', rank: 'head' },
    { id: 'p3', unitId: 'd1', rank: 'staff' },
  ];
  it('memakai level 2 bila ada unit berjabatan di sana', () => {
    const units = [
      { id: 'b1', level: 1 },
      { id: 'd1', level: 2 },
      { id: 'd2', level: 2 },
    ];
    expect(allTargetUnits(units, positions)).toEqual({
      level: 2,
      units: [{ id: 'd1', level: 2 }],
    });
  });
  it('jatuh ke level terdangkal berjabatan bila level 2 kosong', () => {
    const units = [
      { id: 'b1', level: 1 },
      { id: 'd2', level: 2 },
    ];
    expect(allTargetUnits(units, positions)).toEqual({
      level: 1,
      units: [{ id: 'b1', level: 1 }],
    });
  });
  it('kosong bila tidak ada jabatan', () => {
    expect(allTargetUnits([{ id: 'x', level: 1 }], [])).toEqual({
      level: 2,
      units: [],
    });
  });
});

describe('defaultPositionId', () => {
  it('mengutamakan Staf', () => {
    expect(
      defaultPositionId([
        { id: 'a', unitId: 'u', rank: 'head' },
        { id: 'b', unitId: 'u', rank: 'staff' },
      ]),
    ).toBe('b');
    expect(defaultPositionId([{ id: 'a', unitId: 'u', rank: 'head' }])).toBe('a');
  });
});

describe('findAttachment (M-07)', () => {
  it('membandingkan tanpa membedakan huruf', () => {
    expect(findAttachment(['Portofolio'], 'portofolio')).toBe('Portofolio');
    expect(findAttachment(['Portofolio'], ' PORTOFOLIO ')).toBe('Portofolio');
    expect(findAttachment(['Portofolio'], 'CV')).toBeUndefined();
  });
});
