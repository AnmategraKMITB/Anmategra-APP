import { describe, expect, it } from 'vitest';

import { type StageInput, deriveChoiceStage } from './allocation';

const choices = (over: Partial<StageInput>[] = []): StageInput[] =>
  [1, 2, 3].map((rank, i) => ({
    id: `c${rank}`,
    rank,
    status: 'lolos' as const,
    decision: null,
    ...over[i],
  }));

const stages = (
  list: StageInput[],
  options?: Parameters<typeof deriveChoiceStage>[1],
) =>
  Object.fromEntries(
    [...deriveChoiceStage(list, options)].map(([id, r]) => [id, r.stage]),
  );

describe('deriveChoiceStage (S18)', () => {
  it('bertahap: hanya pilihan pertama yang aktif, sisanya menunggu', () => {
    expect(stages(choices())).toEqual({
      c1: 'aktif',
      c2: 'menunggu',
      c3: 'menunggu',
    });
  });

  it('bertahap: pilihan bergeser setelah ditolak', () => {
    expect(stages(choices([{ decision: 'tolak' }]))).toEqual({
      c1: 'tertutup',
      c2: 'aktif',
      c3: 'menunggu',
    });
  });

  it('sekaligus: semua pilihan yang belum gagal langsung aktif', () => {
    expect(stages(choices(), { staged: false })).toEqual({
      c1: 'aktif',
      c2: 'aktif',
      c3: 'aktif',
    });
  });

  it('sekaligus: pilihan yang ditolak atau tidak lolos tertutup', () => {
    expect(
      stages(choices([{ decision: 'tolak' }, { status: 'tidak_lolos' }]), {
        staged: false,
      }),
    ).toEqual({ c1: 'tertutup', c2: 'tertutup', c3: 'aktif' });
  });

  it('sekaligus: satu penerimaan menutup pilihan lain', () => {
    expect(
      stages(choices([{}, { decision: 'terima' }]), { staged: false }),
    ).toEqual({ c1: 'tertutup', c2: 'aktif', c3: 'tertutup' });
  });
});
