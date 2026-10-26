import { describe, it, expect, vi, afterEach } from 'vitest';

// The data is authored around 05/15/2025 and moved forward so it always ends on the real date
describe('demo calendar follows the real date', () => {
  afterEach(() => { vi.setSystemTime(new Date(2025, 4, 15, 10, 0)); vi.resetModules(); });

  it('on the base day nothing moves', async () => {
    const d = await import('../utils/dates');
    expect(d.TODAY_ISO).toBe('2025-05-15');
    expect(d.OFFSET).toBe(0);
    expect(d.MONTHS).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May']);
  });

  it('on another day the same calls end today, with months and seeds moved along', async () => {
    const base = await import('../data/calls');
    const baseCall = base.callById('2857391');
    const baseCount = base.CALLS.length;
    vi.resetModules();
    vi.setSystemTime(new Date(2026, 9, 26, 15, 30));
    const d = await import('../utils/dates');
    const { CALLS, callById } = await import('../data/calls');
    const { SEED_SESSIONS } = await import('../data/seeds');
    expect(d.TODAY_ISO).toBe('2026-10-26');
    expect(d.longToday).toBe('Monday, October 26, 2026');
    expect(d.MONTHS).toEqual(['Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect(d.MONTHS_LONG[d.CUR]).toBe('October 2026');
    expect(d.monthRange(d.CUR)).toEqual(['2026-10-01', '2026-10-26']);
    expect(CALLS.length).toBe(baseCount);
    expect(CALLS[0].iso).toBe('2026-10-26');
    const moved = callById('2857391');
    expect(moved.iso).toBe(d.addDays('2026-10-26', -1));
    expect(moved.ai).toEqual(baseCall.ai);
    expect(SEED_SESSIONS.find((s) => s.id === 's1').date).toBe('10/25/2026');
    expect(CALLS.every((c) => c.month >= -1 && c.month <= d.CUR)).toBe(true);
  });
});
