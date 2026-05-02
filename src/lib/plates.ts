// Plate breakdown — given a target weight and the user's available plates,
// figure out which plates to load on each side of an Olympic bar.
//
// All math is in the user's chosen unit (lb or kg). The bar weight is
// hardcoded to the Olympic standard since that's what the 5/3/1 calculator
// already assumes.

import { Unit } from './types';

export const STANDARD_BAR: Record<Unit, number> = {
  lb: 45,
  kg: 20,
};

export const STANDARD_PLATES: Record<Unit, number[]> = {
  lb: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

export interface PlateBreakdown {
  // Plates to put on each side of the bar, largest first.
  perSide: number[];
  // True when the target is at or below the bar — no plates needed.
  barOnly: boolean;
  // False when the available plates can't sum to the target exactly; the
  // breakdown is then the closest the greedy algorithm could get.
  exact: boolean;
  // Total weight you'd actually be lifting if you load `perSide` on each side.
  actualWeight: number;
}

const TOLERANCE = 0.001;

export function breakdown(
  target: number,
  unit: Unit,
  available: number[]
): PlateBreakdown {
  const bar = STANDARD_BAR[unit];
  if (target <= bar + TOLERANCE) {
    return {
      perSide: [],
      barOnly: true,
      exact: Math.abs(target - bar) < TOLERANCE,
      actualWeight: bar,
    };
  }
  const perSideTarget = (target - bar) / 2;
  const sorted = [...available].sort((a, b) => b - a);
  const perSide: number[] = [];
  let remaining = perSideTarget;
  for (const plate of sorted) {
    while (remaining >= plate - TOLERANCE) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return {
    perSide,
    barOnly: false,
    exact: Math.abs(remaining) < TOLERANCE,
    actualWeight: bar + 2 * (perSideTarget - remaining),
  };
}

export function formatBreakdown(
  b: PlateBreakdown,
  target: number,
  unit: Unit
): string {
  if (b.barOnly) {
    return b.exact ? 'Bar only' : 'Less than bar';
  }
  if (b.perSide.length === 0) {
    return 'No plates configured';
  }
  const sides = b.perSide.map((n) => n.toString()).join(' + ');
  if (b.exact) return `${sides} per side`;
  const short = Math.round((target - b.actualWeight) * 100) / 100;
  return `${sides} per side · ${short} ${unit} short`;
}
