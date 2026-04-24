// Shared type definitions. Every screen and helper imports from here, so
// this file is the canonical shape of the app's data.
//
//   LiftKey      — the four big lifts tracked by 5/3/1.
//   RepScheme    — which week of the cycle the user is on. `555` / `333` /
//                  `531` are the three working-set weeks; `deload` is the
//                  fourth (lighter) week.
//   WorkoutLog   — one saved session. Stored in AsyncStorage under
//                  `gymtracker_logs` as an array, newest first.
//   AppSettings  — everything in the Settings tab. Stored under
//                  `gymtracker_settings`.

export type LiftKey = 'squat' | 'bench' | 'deadlift' | 'ohp';

export const LIFTS: { key: LiftKey; name: string }[] = [
  { key: 'squat', name: 'Squat' },
  { key: 'bench', name: 'Bench Press' },
  { key: 'deadlift', name: 'Deadlift' },
  { key: 'ohp', name: 'OHP' },
];

export interface LiftData {
  tm: number | null;
  assistance: string;
}

export const LIFT_COLOR: Record<LiftKey, string> = {
  squat: '#4ADE80',
  bench: '#F87171',
  deadlift: '#FBBF24',
  ohp: '#60A5FA',
};

export interface WorkoutSet {
  weight: number;
  reps: number;
}

export interface WorkoutLog {
  id: string;
  liftKey: LiftKey;
  repScheme: RepScheme;
  sets: WorkoutSet[];
  date: string;
}

export interface AppSettings {
  unit: 'lb' | 'kg';
  repScheme: RepScheme;
  darkMode: 'auto' | 'light' | 'dark';
}

export type Unit = 'lb' | 'kg';
export type RepScheme = '555' | '333' | '531' | 'deload';
export type DarkMode = 'auto' | 'light' | 'dark';