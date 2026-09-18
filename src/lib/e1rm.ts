// Estimated 1-rep max and PR detection. 5/3/1 measures progress by the
// AMRAP top set, and Epley turns (weight × reps) into a comparable
// number: e1RM = w · (1 + r/30).
//
// PRs are always *derived* from the log history, never stored — editing
// or deleting a session automatically recomputes what counts as a PR.

import { LiftKey, WorkoutLog } from './types';

export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

// The best estimated 1RM across a session's sets.
export function bestE1rm(log: WorkoutLog): number {
  return log.sets.reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0);
}

// Ids of logs that beat the lift's previous best e1RM at their point in
// time. The first-ever session of a lift is the baseline, not a PR —
// celebrating it would be noise.
export function prIds(logs: WorkoutLog[]): Set<string> {
  const chron = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const best: Partial<Record<LiftKey, number>> = {};
  const ids = new Set<string>();
  for (const log of chron) {
    const v = bestE1rm(log);
    if (v <= 0) continue;
    const prev = best[log.liftKey] ?? 0;
    if (v > prev + 1e-9) {
      if (prev > 0) ids.add(log.id);
      best[log.liftKey] = v;
    }
  }
  return ids;
}
