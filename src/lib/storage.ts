// Persistence layer. Every read/write of user data goes through this module
// so the AsyncStorage keys ("gymtracker_*") live in exactly one place and
// the rest of the app never touches AsyncStorage directly.
//
// AsyncStorage on the web is just localStorage under the hood (via the
// `@react-native-async-storage/async-storage` polyfill), so the data stays
// in the user's browser. That's why this app has no server — everything you
// see in Train/Log/Settings is read from these three keys below.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LiftKey,
  LiftData,
  WorkoutLog,
  WorkoutSet,
  AppSettings,
  RepScheme,
  Unit,
  DarkMode,
} from './types';

const KEYS = {
  LIFTS: 'gymtracker_lifts',
  LOGS: 'gymtracker_logs',
  SETTINGS: 'gymtracker_settings',
} as const;

export const STORAGE_KEYS = [KEYS.LIFTS, KEYS.LOGS, KEYS.SETTINGS] as const;

export type LiftsMap = Record<LiftKey, LiftData>;

const EMPTY_LIFTS: LiftsMap = {
  squat: { tm: null, assistance: '' },
  bench: { tm: null, assistance: '' },
  deadlift: { tm: null, assistance: '' },
  ohp: { tm: null, assistance: '' },
};

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'lb',
  repScheme: '555',
  darkMode: 'auto',
};

// --- Lifts ------------------------------------------------------------------

export async function getLifts(): Promise<LiftsMap> {
  const raw = await AsyncStorage.getItem(KEYS.LIFTS);
  if (!raw) return { ...EMPTY_LIFTS };
  try {
    // Older builds stored `assistance` as a string[]. Normalize to a single
    // multi-line string on read so the rest of the app can assume strings.
    const parsed = JSON.parse(raw) as Record<
      LiftKey,
      { tm: number | null; assistance: string | string[] }
    >;
    const out = { ...EMPTY_LIFTS };
    (Object.keys(parsed) as LiftKey[]).forEach((k) => {
      const entry = parsed[k];
      if (!entry) return;
      out[k] = {
        tm: entry.tm ?? null,
        assistance: Array.isArray(entry.assistance)
          ? entry.assistance.join('\n')
          : entry.assistance ?? '',
      };
    });
    return out;
  } catch {
    return { ...EMPTY_LIFTS };
  }
}

export async function saveLifts(lifts: LiftsMap): Promise<void> {
  await AsyncStorage.setItem(KEYS.LIFTS, JSON.stringify(lifts));
}

// --- Logs -------------------------------------------------------------------

export async function getLogs(): Promise<WorkoutLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.LOGS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WorkoutLog[];
  } catch {
    return [];
  }
}

export async function saveLogs(logs: WorkoutLog[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

// Newest log ends up first — matches the feed ordering.
export async function appendLog(log: WorkoutLog): Promise<WorkoutLog[]> {
  const logs = await getLogs();
  logs.unshift(log);
  await saveLogs(logs);
  return logs;
}

export async function deleteLog(id: string): Promise<WorkoutLog[]> {
  const logs = await getLogs();
  const next = logs.filter((l) => l.id !== id);
  await saveLogs(next);
  return next;
}

export async function updateLogSets(
  id: string,
  sets: WorkoutSet[]
): Promise<WorkoutLog[]> {
  const logs = await getLogs();
  const next = logs.map((l) => (l.id === id ? { ...l, sets } : l));
  await saveLogs(next);
  return next;
}

// --- Settings ---------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function patchSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch };
  await saveSettings(next);
  return next;
}

// Convenience wrappers — keep callers declarative at the cost of a little duplication.
export const getUnit = async (): Promise<Unit> => (await getSettings()).unit;
export const setUnit = (unit: Unit) => patchSettings({ unit });
export const getRepScheme = async (): Promise<RepScheme> =>
  (await getSettings()).repScheme;
export const setRepScheme = (repScheme: RepScheme) =>
  patchSettings({ repScheme });
export const getDarkMode = async (): Promise<DarkMode> =>
  (await getSettings()).darkMode;
export const setDarkMode = (darkMode: DarkMode) =>
  patchSettings({ darkMode });

// --- Backup / restore -------------------------------------------------------
// These power the Export/Import buttons in Settings. The payload is a plain
// object keyed by storage key; each value is the already-parsed JSON so the
// file is human-readable.

export interface BackupFile {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export async function exportAll(): Promise<BackupFile> {
  const entries = await AsyncStorage.multiGet(STORAGE_KEYS as unknown as string[]);
  const data: Record<string, unknown> = {};
  for (const [key, raw] of entries) {
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

// Replaces current state with the backup. We only restore known keys so a
// tampered file can't inject arbitrary keys into storage.
export async function importAll(payload: unknown): Promise<void> {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    typeof (payload as BackupFile).data !== 'object'
  ) {
    throw new Error('Invalid backup file');
  }
  const { data } = payload as BackupFile;
  const writes: [string, string][] = [];
  for (const key of STORAGE_KEYS) {
    if (key in data) {
      writes.push([key, JSON.stringify((data as Record<string, unknown>)[key])]);
    }
  }
  if (writes.length === 0) throw new Error('Backup file contained no known data');
  await AsyncStorage.multiSet(writes);
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(STORAGE_KEYS as unknown as string[]);
}
