import { describe, expect, it } from 'vitest';
import { e1rm, bestE1rm, prIds } from './e1rm';
import { WorkoutLog } from './types';

let n = 0;
const log = (
  liftKey: WorkoutLog['liftKey'],
  date: string,
  sets: [number, number][]
): WorkoutLog => ({
  id: `l${n++}`,
  liftKey,
  repScheme: '531',
  sets: sets.map(([weight, reps]) => ({ weight, reps })),
  date,
});

describe('e1rm', () => {
  it('applies Epley', () => {
    expect(e1rm(300, 1)).toBeCloseTo(310);
    expect(e1rm(225, 10)).toBeCloseTo(300);
  });

  it('is zero for skipped or empty sets', () => {
    expect(e1rm(300, 0)).toBe(0);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('bestE1rm picks the strongest set, not the heaviest', () => {
    // 200×10 (≈266) beats 240×1 (248)
    const l = log('bench', '2026-01-05T10:00:00Z', [[240, 1], [200, 10]]);
    expect(bestE1rm(l)).toBeCloseTo(200 * (1 + 10 / 30));
  });
});

describe('prIds', () => {
  it('marks improvements but not the baseline session', () => {
    const a = log('squat', '2026-01-01T10:00:00Z', [[300, 5]]); // baseline
    const b = log('squat', '2026-01-08T10:00:00Z', [[300, 8]]); // PR
    const c = log('squat', '2026-01-15T10:00:00Z', [[300, 6]]); // worse
    const d = log('squat', '2026-01-22T10:00:00Z', [[315, 8]]); // PR
    const ids = prIds([d, b, a, c]); // order must not matter
    expect(ids.has(a.id)).toBe(false);
    expect(ids.has(b.id)).toBe(true);
    expect(ids.has(c.id)).toBe(false);
    expect(ids.has(d.id)).toBe(true);
  });

  it('tracks lifts independently', () => {
    const s1 = log('squat', '2026-01-01T10:00:00Z', [[300, 5]]);
    const b1 = log('bench', '2026-01-02T10:00:00Z', [[200, 5]]);
    const b2 = log('bench', '2026-01-09T10:00:00Z', [[200, 9]]);
    const ids = prIds([s1, b1, b2]);
    expect(ids.has(b2.id)).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('deload sessions never register as PRs', () => {
    const heavy = log('ohp', '2026-01-01T10:00:00Z', [[135, 5]]);
    const deload = log('ohp', '2026-01-08T10:00:00Z', [[80, 5]]);
    expect(prIds([heavy, deload]).has(deload.id)).toBe(false);
  });
});
