import { describe, expect, it } from 'vitest';
import { warmupRows } from './warmup';

describe('warmupRows', () => {
  it('builds the 40/50/60 ramp with loadable weights', () => {
    const rows = warmupRows(315, 'lb');
    expect(rows.map((r) => r.reps)).toEqual([5, 5, 3]);
    expect(rows.map((r) => r.pct)).toEqual([0.4, 0.5, 0.6]);
    for (const r of rows) {
      expect(r.weight % 5).toBe(0);
    }
    expect(rows[2].weight).toBe(190); // 315 × 0.6 = 189 → nearest 5
  });
});
