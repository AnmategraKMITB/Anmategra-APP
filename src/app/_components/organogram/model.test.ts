import { describe, expect, it } from 'vitest';
import {
  computeLevels,
  validateTree,
} from '~/server/api/routers/organization/tree';

import {
  type Draft,
  MAX_LEVEL,
  ROOT_DEPTH,
  type Unit,
  createHistory,
  editorReducer,
  levelLabelFor,
  maxDepth,
  statsOf,
  topLevelParent,
  unitTypeLabel,
  visibleRows,
} from './model';

const unit = (id: string, parentId: string | null, sortOrder = 0): Unit => ({
  id,
  parentId,
  name: id,
  typeLabel: null,
  description: null,
  sortOrder,
  layout: {},
});

/** Akar > Bidang (IT, Acara) > Divisi (Web di IT). */
const units = [
  unit('akar', null),
  unit('it', 'akar', 0),
  unit('acara', 'akar', 1),
  unit('web', 'it', 0),
];

const draft: Draft = {
  name: 'AMI',
  levelLabels: ['Bidang', 'Divisi'],
  ranks: null,
  units,
  positions: [],
};

describe('kedalaman organogram (akar = 0)', () => {
  it('akar di kedalaman 0, bidang 1, divisi 2', () => {
    expect(ROOT_DEPTH).toBe(0);
    const levels = computeLevels(units);
    expect(levels.get('akar')).toBe(0);
    expect(levels.get('it')).toBe(1);
    expect(levels.get('web')).toBe(2);
    expect(maxDepth(units)).toBe(2);
  });

  it('level_labels[0] menamai tingkat 1, bukan akar', () => {
    expect(levelLabelFor(1, draft.levelLabels)).toBe('Bidang');
    expect(levelLabelFor(2, draft.levelLabels)).toBe('Divisi');
    expect(levelLabelFor(0, draft.levelLabels)).toBe('Bagian');
    expect(
      unitTypeLabel({ ...units[0]!, typeLabel: 'Kepanitiaan' }, 0, null),
    ).toBe('Kepanitiaan');
  });

  it('statistik dihitung per kedalaman dengan akar di indeks 0', () => {
    expect(statsOf(draft)).toMatchObject({
      levelCounts: [1, 2, 1],
      depth: 2,
    });
  });

  it('baris struktur mulai dari kedalaman akar', () => {
    const rows = visibleRows(draft, new Set(['akar', 'it']));
    expect(rows.map((r) => [r.unit.id, r.depth])).toEqual([
      ['akar', 0],
      ['it', 1],
      ['web', 2],
      ['acara', 1],
    ]);
  });

  it('tambah di tingkat atas: akar bila kosong, selain itu di bawah akar', () => {
    expect(topLevelParent([])).toBeNull();
    expect(topLevelParent(units)).toBe('akar');
  });

  it('batas kedalaman tetap MAX_TREE_DEPTH tingkat termasuk akar', () => {
    const chain: Unit[] = [];
    for (let level = 0; level <= MAX_LEVEL; level += 1) {
      chain.push(unit(`u${level}`, level === 0 ? null : `u${level - 1}`));
    }
    const tree = {
      units: chain.map((u) => ({ ...u, layout: null })),
      positions: [],
    };
    expect(validateTree(tree)).toEqual([]);

    // Anak di bawah kedalaman terdalam ditolak, di validator maupun reducer.
    const deeper = [
      ...tree.units,
      { ...unit('terlalu-dalam', `u${MAX_LEVEL}`), layout: null },
    ];
    expect(validateTree({ units: deeper, positions: [] })).not.toEqual([]);

    const history = createHistory({ ...draft, units: chain });
    const after = editorReducer(history, {
      type: 'addUnit',
      id: 'baru',
      parentId: `u${MAX_LEVEL}`,
    });
    expect(after).toBe(history);
  });
});
