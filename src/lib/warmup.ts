// Standard 5/3/1 warm-up: 40/50/60% of TM × 5/5/3, rounded to loadable
// weights like the working sets. Not shown during the deload week —
// deload's working sets ARE these percentages.

import { Unit } from './types';
import { calculateWeight } from './531';

export const WARMUP_PCTS = [0.4, 0.5, 0.6];
export const WARMUP_REPS = [5, 5, 3];

export interface WarmupRow {
  pct: number;
  reps: number;
  weight: number;
}

export function warmupRows(tm: number, unit: Unit): WarmupRow[] {
  return WARMUP_PCTS.map((pct, i) => ({
    pct,
    reps: WARMUP_REPS[i],
    weight: calculateWeight(tm, pct, unit),
  }));
}
