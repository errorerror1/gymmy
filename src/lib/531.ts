// The 5/3/1 math: given a Training Max and a rep scheme, produce the
// three working sets (percentage of TM × rep count).
//
// Jim Wendler's 5/3/1 program runs on a 4-week cycle:
//   Week 1 "555"    65 / 75 / 85 %  × 5 / 5 / 5 reps
//   Week 2 "333"    70 / 80 / 90 %  × 3 / 3 / 3 reps
//   Week 3 "531"    75 / 85 / 95 %  × 5 / 3 / 1 reps
//   Week 4 "deload" 40 / 50 / 60 %  × 5 / 5 / 5 reps
//
// Training Max is ~90% of your true 1-rep max. Working weights are rounded
// to the nearest plate increment (5 lb or 2.5 kg) so they're loadable in
// the real world.

import { Unit, RepScheme } from './types';

const PERCENTAGES: Record<RepScheme, number[]> = {
  '555': [0.65, 0.75, 0.85],
  '333': [0.70, 0.80, 0.90],
  '531': [0.75, 0.85, 0.95],
  'deload': [0.40, 0.50, 0.60],
};

const REPS: Record<RepScheme, number[]> = {
  '555': [5, 5, 5],
  '333': [3, 3, 3],
  '531': [5, 3, 1],
  'deload': [5, 5, 5],
};

export const INCREMENT = {
  lb: 5,
  kg: 2.5,
};

export function getPercentagesForScheme(scheme: RepScheme | undefined): number[] {
  return scheme ? PERCENTAGES[scheme] : PERCENTAGES['555'];
}

export function getRepsForScheme(scheme: RepScheme | undefined): number[] {
  return scheme ? REPS[scheme] : REPS['555'];
}

export function calculateWeight(tm: number, percentage: number, unit: Unit): number {
  const rawWeight = tm * percentage;
  const increment = INCREMENT[unit];
  return Math.round(rawWeight / increment) * increment;
}

export function formatWeight(weight: number, unit: Unit): string {
  return `${weight}${unit}`;
}

export function getTabLabels(): string[] {
  return ['555', '333', '531', 'deload'];
}