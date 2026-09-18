// Train screen — the first tab.
//
// Layout: a horizontal pager with one page per lift (squat / bench / deadlift / OHP).
// Each page shows:
//   - the rep scheme picker (555 / 333 / 531 / deload)
//   - the Training Max (hold-then-drag to edit; one-tap bump chip when the
//     cycle helper is on)
//   - optional collapsible warm-up rows (40/50/60%)
//   - the 3 working sets, calculated from TM × scheme percentages; the top
//     set gets an AMRAP rep stepper when that feature is on
//   - a free-text accessory/notes area
//
// The Save button is pinned to the bottom of the screen — never behind a
// scroll — and saves the currently visible lift. Feedback goes through
// toast() because Alert.alert renders nothing on react-native-web.
//
// All persistence goes through src/lib/storage.ts — this screen never
// touches AsyncStorage directly.

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  AppSettings,
  FeatureFlags,
  LiftData,
  LiftKey,
  LIFTS,
  RepScheme,
  Unit,
  WorkoutLog,
  WorkoutSet,
} from '../../src/lib/types';
import { ThemeColors, useTheme } from '../../src/lib/theme';
import {
  calculateWeight,
  formatWeightValue,
  getPercentagesForScheme,
  getRepsForScheme,
  INCREMENT,
} from '../../src/lib/531';
import { breakdown, formatBreakdown } from '../../src/lib/plates';
import { e1rm } from '../../src/lib/e1rm';
import { lastLogFor, nextScheme, tmBump, weekComplete } from '../../src/lib/cycle';
import { warmupRows } from '../../src/lib/warmup';
import {
  DEFAULT_SETTINGS,
  appendLog,
  getLifts,
  getLogs,
  getSettings,
  patchSettings,
  saveLifts,
  type LiftsMap,
} from '../../src/lib/storage';
import { confirmDestructive } from '../../src/lib/confirm';
import { GText } from '../../src/components/GText';
import { toast } from '../../src/components/Toast';
import { AssistNotes } from '../../src/components/AssistNotes';
import { SchemeTab } from '../../src/components/SchemeTab';
import { TMDragValue } from '../../src/components/TMDragValue';

const EMPTY_LIFTS: LiftsMap = {
  squat: { tm: null, assistance: '' },
  bench: { tm: null, assistance: '' },
  deadlift: { tm: null, assistance: '' },
  ohp: { tm: null, assistance: '' },
};

function lastLoggedLine(log: WorkoutLog | undefined): string | null {
  if (!log) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(log.date);
  then.setHours(0, 0, 0, 0);
  const days = Math.round((now.getTime() - then.getTime()) / 86400000);
  const when =
    days <= 0
      ? 'today'
      : days === 1
        ? 'yesterday'
        : days < 7
          ? `${days}d ago`
          : new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Last: ${when} · ${log.repScheme}`;
}

export default function TrainScreen() {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [lifts, setLifts] = useState<LiftsMap>(EMPTY_LIFTS);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [tmDragLocked, setTmDragLocked] = useState(false);
  // Actual reps achieved on the AMRAP top set, per lift; undefined = the
  // prescribed count. Reset on scheme change and after a save.
  const [actualReps, setActualReps] = useState<Partial<Record<LiftKey, number>>>({});
  const [savedFlash, setSavedFlash] = useState<LiftKey | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [loadedSettings, loadedLifts, loadedLogs] = await Promise.all([
        getSettings(),
        getLifts(),
        getLogs(),
      ]);
      setSettings(loadedSettings);
      setLifts(loadedLifts);
      setLogs(loadedLogs);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const persistLifts = async (next: LiftsMap) => {
    setLifts(next);
    await saveLifts(next);
  };

  const updateTM = (liftKey: LiftKey, newTM: number | null) => {
    persistLifts({ ...lifts, [liftKey]: { ...lifts[liftKey], tm: newTM } });
  };

  const updateAssistance = (liftKey: LiftKey, text: string) => {
    const lift = lifts[liftKey];
    if (lift.assistance === text) return;
    persistLifts({ ...lifts, [liftKey]: { ...lift, assistance: text } });
  };

  const changeRepScheme = async (scheme: RepScheme) => {
    setSettings((s) => ({ ...s, repScheme: scheme }));
    setActualReps({});
    await patchSettings({ repScheme: scheme });
  };

  const bumpTM = (liftKey: LiftKey) => {
    const lift = lifts[liftKey];
    if (!lift.tm) return;
    const inc = tmBump(liftKey, settings.unit);
    const next = lift.tm + inc;
    updateTM(liftKey, next);
    toast(`TM +${inc} → ${formatWeightValue(next, settings.unit)} ${settings.unit}`);
  };

  const buildSets = (liftKey: LiftKey): WorkoutSet[] => {
    const tm = lifts[liftKey].tm!;
    const percentages = getPercentagesForScheme(settings.repScheme);
    const reps = getRepsForScheme(settings.repScheme);
    return percentages.map((pct, i) => {
      const isTop = i === percentages.length - 1;
      const actual =
        isTop && settings.features.amrap ? actualReps[liftKey] ?? reps[i] : reps[i];
      return {
        weight: calculateWeight(tm, pct, settings.unit),
        reps: actual,
      };
    });
  };

  const handleSave = (liftKey: LiftKey, liftName: string) => {
    const lift = lifts[liftKey];
    if (!lift.tm) {
      toast('Set a Training Max first');
      return;
    }
    const doSave = async () => {
      const log: WorkoutLog = {
        id: Date.now().toString(),
        liftKey,
        repScheme: settings.repScheme,
        notes: lift.assistance || undefined,
        sets: buildSets(liftKey),
        date: new Date().toISOString(),
      };
      try {
        const next = await appendLog(log);
        setLogs(next);
        setActualReps((prev) => ({ ...prev, [liftKey]: undefined }));
        toast(`${liftName} logged`);
        setSavedFlash(liftKey);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setSavedFlash(null), 1600);
      } catch (e) {
        toast('Failed to save workout');
      }
    };
    const todayKey = new Date().toISOString().slice(0, 10);
    const dup = logs.some(
      (l) => l.liftKey === liftKey && l.date.slice(0, 10) === todayKey
    );
    if (dup) {
      confirmDestructive(
        'Already logged today',
        `${liftName} already has an entry today. Save another?`,
        doSave,
        'Save'
      );
      return;
    }
    doSave();
  };

  const currentLift = LIFTS[currentIndex];
  const weekDone =
    settings.features.cycleHelper && logs.length > 0 && weekComplete(logs, settings.repScheme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topHeader}>
        <GText style={styles.liftTitle}>{currentLift.name}</GText>
        <View style={styles.pagination}>
          {LIFTS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentIndex ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
      </View>
      <ScrollView
        style={styles.pager}
        horizontal
        pagingEnabled
        scrollEnabled={!tmDragLocked}
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          if (page !== currentIndex) setCurrentIndex(page);
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {LIFTS.map((lift) => (
          <View key={lift.key} style={{ flex: 1, width: screenWidth }}>
            <LiftPage
              lift={lift}
              liftData={lifts[lift.key]}
              lastLog={lastLogFor(logs, lift.key)}
              unit={settings.unit}
              repScheme={settings.repScheme}
              features={settings.features}
              availablePlates={settings.availablePlates[settings.unit]}
              weekDone={weekDone}
              actualTopReps={actualReps[lift.key]}
              setActualTopReps={(n) =>
                setActualReps((prev) => ({ ...prev, [lift.key]: n }))
              }
              changeRepScheme={changeRepScheme}
              updateTM={(newTM) => updateTM(lift.key, newTM)}
              bumpTM={() => bumpTM(lift.key)}
              updateAssistance={(text) => updateAssistance(lift.key, text)}
              colors={colors}
              onTmDragLock={setTmDragLocked}
              tmDragLocked={tmDragLocked}
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.saveButton,
            savedFlash === currentLift.key && styles.saveButtonDone,
          ]}
          onPress={() => handleSave(currentLift.key, currentLift.name)}
        >
          <GText style={styles.saveButtonText}>
            {savedFlash === currentLift.key ? 'Saved ✓' : `Save ${currentLift.name}`}
          </GText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface LiftPageProps {
  lift: { key: LiftKey; name: string };
  liftData: LiftData;
  lastLog: WorkoutLog | undefined;
  unit: Unit;
  repScheme: RepScheme;
  features: FeatureFlags;
  availablePlates: number[];
  weekDone: boolean;
  actualTopReps: number | undefined;
  setActualTopReps: (n: number) => void;
  changeRepScheme: (scheme: RepScheme) => void;
  updateTM: (newTM: number | null) => void;
  bumpTM: () => void;
  updateAssistance: (text: string) => void;
  colors: ThemeColors;
  onTmDragLock: (locked: boolean) => void;
  tmDragLocked: boolean;
}

function LiftPage({
  lift,
  liftData,
  lastLog,
  unit,
  repScheme,
  features,
  availablePlates,
  weekDone,
  actualTopReps,
  setActualTopReps,
  changeRepScheme,
  updateTM,
  bumpTM,
  updateAssistance,
  colors,
  onTmDragLock,
  tmDragLocked,
}: LiftPageProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const increment = INCREMENT[unit];
  const percentages = getPercentagesForScheme(repScheme);
  const repsList = getRepsForScheme(repScheme);
  const setWeights = liftData.tm
    ? percentages.map((pct) => calculateWeight(liftData.tm!, pct, unit))
    : [0, 0, 0];
  const topIndex = repsList.length - 1;
  const showWarmups =
    features.warmups && liftData.tm != null && repScheme !== 'deload';
  const showAmrap = features.amrap && liftData.tm != null;
  const topReps = actualTopReps ?? repsList[topIndex];
  const lastLine = features.cycleHelper ? lastLoggedLine(lastLog) : null;
  const next = nextScheme(repScheme);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      scrollEnabled={!tmDragLocked}
    >
      <View style={styles.pageBody}>
        {weekDone ? (
          <Pressable style={styles.weekBanner} onPress={() => changeRepScheme(next)}>
            <GText style={styles.weekBannerText}>
              {repScheme === 'deload'
                ? `Deload done — start a new cycle (${next}) and bump your TMs`
                : `${repScheme} week complete — start ${next}`}
            </GText>
          </Pressable>
        ) : null}

        <View style={styles.schemeSelector}>
          {(['555', '333', '531', 'deload'] as RepScheme[]).map((scheme) => (
            <SchemeTab
              key={scheme}
              scheme={scheme}
              active={repScheme === scheme}
              onPress={() => changeRepScheme(scheme)}
              textStyle={styles.schemeTabText}
              activeTextStyle={styles.schemeTabTextActive}
            />
          ))}
        </View>
        {lastLine ? <GText style={styles.lastLine}>{lastLine}</GText> : null}

        <GText style={styles.sectionLabel}>Training Max</GText>
        {liftData.tm != null ? (
          <View style={styles.tmRow}>
            <TMDragValue
              tm={liftData.tm}
              unit={unit}
              increment={increment}
              onChange={updateTM}
              onArmedChange={onTmDragLock}
              colors={colors}
            />
            {features.cycleHelper ? (
              <Pressable style={styles.bumpChip} onPress={bumpTM} hitSlop={6}>
                <GText style={styles.bumpChipText}>+{tmBump(lift.key, unit)}</GText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => updateTM(unit === 'kg' ? 60 : 135)}>
            <GText style={styles.tmPlaceholder}>Tap to set TM</GText>
          </Pressable>
        )}

        {showWarmups ? (
          <>
            <Pressable onPress={() => setWarmupOpen((v) => !v)}>
              <GText style={styles.sectionLabel}>
                Warm-up {warmupOpen ? '▴' : '▾'}
              </GText>
            </Pressable>
            {warmupOpen ? (
              <View style={styles.warmupContainer}>
                {warmupRows(liftData.tm!, unit).map((row, i) => {
                  const b = breakdown(row.weight, unit, availablePlates);
                  return (
                    <View key={i} style={styles.warmupCard}>
                      <GText style={styles.warmupLeft}>
                        {Math.round(row.pct * 100)}% · {row.reps} reps
                      </GText>
                      <View style={styles.warmupRight}>
                        <GText style={styles.warmupWeight}>
                          {formatWeightValue(row.weight, unit)} {unit}
                        </GText>
                        <GText style={styles.warmupBreakdown}>
                          {formatBreakdown(b, row.weight, unit)}
                        </GText>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        <GText style={styles.sectionLabel}>Sets</GText>
        <View style={styles.setsContainer}>
          {repsList.map((rep, i) => {
            const isTop = i === topIndex;
            const b = liftData.tm
              ? breakdown(setWeights[i], unit, availablePlates)
              : null;
            return (
              <View key={i} style={styles.setCard}>
                <View style={styles.setRow}>
                  <View style={styles.setLeft}>
                    <GText style={styles.setNumber}>Set {i + 1}</GText>
                    <GText style={styles.setReps}>
                      {isTop && showAmrap ? `${rep}+ target` : `${rep} reps`}
                    </GText>
                  </View>
                  <GText style={styles.setWeight}>
                    {formatWeightValue(setWeights[i], unit)} {unit}
                  </GText>
                </View>
                {b ? (
                  <GText style={styles.setBreakdown}>
                    {formatBreakdown(b, setWeights[i], unit)}
                  </GText>
                ) : null}
                {isTop && showAmrap ? (
                  <View style={styles.amrapRow}>
                    <GText style={styles.amrapLabel}>Reps done</GText>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => setActualTopReps(Math.max(0, topReps - 1))}
                      >
                        <GText style={styles.stepBtnText}>−</GText>
                      </Pressable>
                      <GText style={styles.stepValue}>{topReps}</GText>
                      <Pressable
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => setActualTopReps(Math.min(50, topReps + 1))}
                      >
                        <GText style={styles.stepBtnText}>+</GText>
                      </Pressable>
                    </View>
                    <GText style={styles.e1rmHint}>
                      {topReps > 0
                        ? `≈ e1RM ${formatWeightValue(
                            e1rm(setWeights[i], topReps),
                            unit
                          )} ${unit}`
                        : 'skipped'}
                    </GText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <GText style={styles.sectionLabel}>Accessory</GText>
        <AssistNotes
          value={liftData.assistance}
          onSave={updateAssistance}
          colors={colors}
        />
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pager: {
      flex: 1,
    },
    page: {
      flex: 1,
    },
    pageContent: {
      paddingBottom: 24,
    },
    pageBody: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    topHeader: {
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
      gap: 14,
    },
    liftTitle: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.5,
    },
    weekBanner: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 18,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    weekBannerText: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      color: colors.primary,
    },
    schemeSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 6,
    },
    lastLine: {
      fontSize: 12,
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 6,
    },
    schemeTabText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    schemeTabTextActive: {
      color: colors.primary,
    },
    sectionLabel: {
      fontSize: 13,
      textAlign: 'center',
      marginTop: 24,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: colors.textSecondary,
    },
    tmPlaceholder: {
      fontSize: 18,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    tmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    bumpChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bumpChipText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    warmupContainer: {
      gap: 8,
    },
    warmupCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    warmupLeft: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    warmupRight: {
      alignItems: 'flex-end',
      gap: 2,
    },
    warmupWeight: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    warmupBreakdown: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    setsContainer: {
      gap: 10,
    },
    setCard: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    setRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    setLeft: {
      flexDirection: 'column',
      gap: 2,
    },
    setBreakdown: {
      fontSize: 12,
      color: colors.textSecondary,
      letterSpacing: 0.3,
    },
    setNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    setReps: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    setWeight: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
    },
    amrapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    amrapLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepBtnText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    stepValue: {
      minWidth: 34,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    e1rmHint: {
      flex: 1,
      textAlign: 'right',
      fontSize: 12,
      color: colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    saveButtonDone: {
      backgroundColor: colors.success,
    },
    saveButtonText: {
      color: colors.background,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
  });
