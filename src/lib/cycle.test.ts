import { describe, expect, it } from 'vitest';
import { lastLogFor, nextScheme, tmBump, weekComplete } from './cycle';
import { RepScheme, WorkoutLog } from './types';

let n = 0;
const log = (
  liftKey: WorkoutLog['liftKey'],
  date: string,
  repScheme: RepScheme
): WorkoutLog => ({
  id: `c${n++}`,
  liftKey,
  repScheme,
  sets: [{ weight: 100, reps: 5 }],
  date,
});

describe('nextScheme', () => {
  it('walks the 4-week cycle in order and wraps', () => {
    expect(nextScheme('555')).toBe('333');
    expect(nextScheme('333')).toBe('531');
    expect(nextScheme('531')).toBe('deload');
    expect(nextScheme('deload')).toBe('555');
  });
});

describe('tmBump', () => {
  it('is +5/+10 lb and +2.5/+5 kg per Wendler', () => {
    expect(tmBump('bench', 'lb')).toBe(5);
    expect(tmBump('ohp', 'lb')).toBe(5);
    expect(tmBump('squat', 'lb')).toBe(10);
    expect(tmBump('deadlift', 'lb')).toBe(10);
    expect(tmBump('bench', 'kg')).toBe(2.5);
    expect(tmBump('squat', 'kg')).toBe(5);
  });
});

describe('weekComplete / lastLogFor', () => {
  const all531 = [
    log('squat', '2026-01-01T10:00:00Z', '531'),
    log('bench', '2026-01-02T10:00:00Z', '531'),
    log('deadlift', '2026-01-03T10:00:00Z', '531'),
    log('ohp', '2026-01-04T10:00:00Z', '531'),
  ];

  it('is complete when every lift last trained under the scheme', () => {
    expect(weekComplete(all531, '531')).toBe(true);
  });

  it('is incomplete while one lift is missing or stale', () => {
    expect(weekComplete(all531.slice(0, 3), '531')).toBe(false);
    const stale = [...all531.slice(0, 3), log('ohp', '2025-12-20T10:00:00Z', '333')];
    expect(weekComplete(stale, '531')).toBe(false);
  });

  it('dissolves after switching the scheme', () => {
    expect(weekComplete(all531, 'deload')).toBe(false);
  });

  it('older sessions cannot mask the newest one', () => {
    const logs = [
      ...all531,
      log('ohp', '2026-01-05T10:00:00Z', '555'), // newer, different scheme
    ];
    expect(weekComplete(logs, '531')).toBe(false);
    expect(lastLogFor(logs, 'ohp')?.repScheme).toBe('555');
  });
});
