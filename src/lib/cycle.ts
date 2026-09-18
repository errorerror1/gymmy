// Cycle-helper logic: where the user is in the 4-week 5/3/1 cycle and
// how the Training Max moves between cycles.

import { LIFTS, LiftKey, RepScheme, Unit, WorkoutLog } from './types';

const ORDER: RepScheme[] = ['555', '333', '531', 'deload'];

export function nextScheme(s: RepScheme): RepScheme {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

// Wendler's between-cycle TM increase: +5 lb upper body, +10 lb lower
// body (kg: +2.5 / +5).
export function tmBump(lift: LiftKey, unit: Unit): number {
  const lower = lift === 'squat' || lift === 'deadlift';
  if (unit === 'kg') return lower ? 5 : 2.5;
  return lower ? 10 : 5;
}

// The newest log for one lift, or undefined if never trained.
export function lastLogFor(
  logs: WorkoutLog[],
  lift: LiftKey
): WorkoutLog | undefined {
  let latest: WorkoutLog | undefined;
  for (const l of logs) {
    if (l.liftKey !== lift) continue;
    if (!latest || new Date(l.date).getTime() > new Date(latest.date).getTime()) {
      latest = l;
    }
  }
  return latest;
}

// A week is complete when the most recent session of every lift was
// logged under the current scheme. Switching the scheme naturally
// dissolves the condition, so the banner disappears on its own.
export function weekComplete(logs: WorkoutLog[], scheme: RepScheme): boolean {
  return LIFTS.every(({ key }) => lastLogFor(logs, key)?.repScheme === scheme);
}
