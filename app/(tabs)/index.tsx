// Train screen — the first tab.
//
// Layout: a horizontal pager with one page per lift (squat / bench / deadlift / OHP).
// Each page shows:
//   - the rep scheme picker (555 / 333 / 531 / deload)
//   - the Training Max (hold-then-drag to edit)
//   - the 3 working sets, calculated from TM × scheme percentages
//   - a free-text accessory/notes area
//   - a Save button that appends a WorkoutLog entry
//
// All persistence goes through src/lib/storage.ts — this screen never
// touches AsyncStorage directly.

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  AppSettings,
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
  getPercentagesForScheme,
  getRepsForScheme,
  INCREMENT,
} from '../../src/lib/531';
import {
  DEFAULT_SETTINGS,
  appendLog,
  getLifts,
  getSettings,
  patchSettings,
  saveLifts,
  type LiftsMap,
} from '../../src/lib/storage';
import { GText } from '../../src/components/GText';
import { AssistNotes } from '../../src/components/AssistNotes';
import { SchemeTab } from '../../src/components/SchemeTab';
import { TMDragValue } from '../../src/components/TMDragValue';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EMPTY_LIFTS: LiftsMap = {
  squat: { tm: null, assistance: '' },
  bench: { tm: null, assistance: '' },
  deadlift: { tm: null, assistance: '' },
  ohp: { tm: null, assistance: '' },
};

function formatWeightValue(v: number, unit: Unit): string {
  return unit === 'kg' ? v.toFixed(1) : v.toFixed(0);
}

export default function TrainScreen() {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Which lift is currently on screen (pager index).
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [lifts, setLifts] = useState<LiftsMap>(EMPTY_LIFTS);

  // While the TMDragValue is armed we lock both ScrollViews so the drag wins.
  const [tmDragLocked, setTmDragLocked] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [loadedSettings, loadedLifts] = await Promise.all([
        getSettings(),
        getLifts(),
      ]);
      setSettings(loadedSettings);
      setLifts(loadedLifts);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }, []);

  // Reload on focus so changes from the edit modal or Settings show up.
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
    await patchSettings({ repScheme: scheme });
  };

  const handleSave = async (liftKey: LiftKey, liftName: string) => {
    const lift = lifts[liftKey];
    if (!lift.tm) {
      Alert.alert('No TM', 'Please set your Training Max first');
      return;
    }
    const percentages = getPercentagesForScheme(settings.repScheme);
    const reps = getRepsForScheme(settings.repScheme);
    const sets: WorkoutSet[] = percentages.map((pct, i) => ({
      weight: calculateWeight(lift.tm!, pct, settings.unit),
      reps: reps[i],
    }));
    const log: WorkoutLog = {
      id: Date.now().toString(),
      liftKey,
      repScheme: settings.repScheme,
      sets,
      date: new Date().toISOString(),
    };
    try {
      await appendLog(log);
      Alert.alert('Saved', `${liftName} workout logged`);
    } catch (e) {
      Alert.alert('Error', 'Failed to save workout');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topHeader}>
        <GText style={styles.liftTitle}>{LIFTS[currentIndex].name}</GText>
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
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (page !== currentIndex) setCurrentIndex(page);
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {LIFTS.map((lift) => (
          <View key={lift.key} style={styles.pageWrapper}>
            <LiftPage
              lift={lift}
              liftData={lifts[lift.key]}
              unit={settings.unit}
              repScheme={settings.repScheme}
              changeRepScheme={changeRepScheme}
              updateTM={(newTM) => updateTM(lift.key, newTM)}
              updateAssistance={(text) => updateAssistance(lift.key, text)}
              handleSave={() => handleSave(lift.key, lift.name)}
              colors={colors}
              onTmDragLock={setTmDragLocked}
              tmDragLocked={tmDragLocked}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

interface LiftPageProps {
  lift: { key: LiftKey; name: string };
  liftData: LiftData;
  unit: Unit;
  repScheme: RepScheme;
  changeRepScheme: (scheme: RepScheme) => void;
  updateTM: (newTM: number | null) => void;
  updateAssistance: (text: string) => void;
  handleSave: () => void;
  colors: ThemeColors;
  onTmDragLock: (locked: boolean) => void;
  tmDragLocked: boolean;
}

function LiftPage({
  lift,
  liftData,
  unit,
  repScheme,
  changeRepScheme,
  updateTM,
  updateAssistance,
  handleSave,
  colors,
  onTmDragLock,
  tmDragLocked,
}: LiftPageProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const increment = INCREMENT[unit];
  const percentages = getPercentagesForScheme(repScheme);
  const repsList = getRepsForScheme(repScheme);
  const setWeights = liftData.tm
    ? percentages.map((pct) => calculateWeight(liftData.tm!, pct, unit))
    : [0, 0, 0];

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      scrollEnabled={!tmDragLocked}
    >
      <View style={styles.pageBody}>
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

        <GText style={styles.sectionLabel}>Training Max</GText>
        {liftData.tm != null ? (
          <TMDragValue
            tm={liftData.tm}
            unit={unit}
            increment={increment}
            onChange={updateTM}
            onArmedChange={onTmDragLock}
            colors={colors}
          />
        ) : (
          // Seed to 135 lb — the classic "empty barbell + two 45s" starting point.
          <Pressable onPress={() => updateTM(135)}>
            <GText style={styles.tmPlaceholder}>Tap to set TM</GText>
          </Pressable>
        )}

        <GText style={styles.sectionLabel}>Sets</GText>
        <View style={styles.setsContainer}>
          {repsList.map((rep, i) => (
            <View key={i} style={styles.setCard}>
              <View style={styles.setLeft}>
                <GText style={styles.setNumber}>Set {i + 1}</GText>
                <GText style={styles.setReps}>{rep} reps</GText>
              </View>
              <GText style={styles.setWeight}>
                {formatWeightValue(setWeights[i], unit)} {unit}
              </GText>
            </View>
          ))}
        </View>

        <GText style={styles.sectionLabel}>Accessory</GText>
        <AssistNotes
          value={liftData.assistance}
          onSave={updateAssistance}
          colors={colors}
        />

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <GText style={styles.saveButtonText}>Save Workout</GText>
        </Pressable>
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
    pageWrapper: {
      flex: 1,
      width: SCREEN_WIDTH,
    },
    page: {
      flex: 1,
    },
    pageContent: {
      paddingBottom: 120,
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
    schemeSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 28,
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
    setsContainer: {
      gap: 10,
    },
    setCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setLeft: {
      flexDirection: 'column',
      gap: 2,
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
    saveButton: {
      marginTop: 32,
      marginHorizontal: 8,
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    saveButtonText: {
      color: colors.background,
      fontSize: 18,
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
