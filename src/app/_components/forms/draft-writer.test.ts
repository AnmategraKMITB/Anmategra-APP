import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DRAFT_DEBOUNCE_MS, createDraftWriter } from './draft-writer';

describe('createDraftWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('menulis sekali dengan jawaban terbaru setelah jeda', () => {
    const write = vi.fn();
    const w = createDraftWriter(write);
    w.schedule('k', { a: 'h' });
    vi.advanceTimersByTime(200);
    w.schedule('k', { a: 'ha' });
    vi.advanceTimersByTime(200);
    w.schedule('k', { a: 'hai' });
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('k', { a: 'hai' });
  });

  it('flush menulis seketika dan tidak menulis ganda', () => {
    const write = vi.fn();
    const w = createDraftWriter(write);
    w.schedule('k', { a: '1' });
    w.flush();
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('flush tanpa tulisan tertunda tidak menulis apa pun', () => {
    const write = vi.fn();
    createDraftWriter(write).flush();
    expect(write).not.toHaveBeenCalled();
  });

  it('cancel membuang tulisan yang tertunda', () => {
    const write = vi.fn();
    const w = createDraftWriter(write);
    w.schedule('k', { a: '1' });
    w.cancel();
    vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS * 2);
    expect(write).not.toHaveBeenCalled();
  });
});
