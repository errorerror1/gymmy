// Log screen — progress tab. Shows three things, top to bottom:
//
//   1. A year-long workout heatmap (see src/components/Heatmap.tsx).
//      Tapping a day scrolls the session feed to that day.
//   2. A swipeable feed of every saved session. Swipe right to edit,
//      swipe left to delete. The SwipeableRow gesture handling is the
//      trickiest part of this screen — see inline comments there.
//   3. A collapsible trend chart showing inferred Training Max over time
//      per lift. "Inferred" because a given log doesn't actually store
//      its TM — we back it out from the top set's weight and the rep
//      scheme's top-set percentage.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  SectionList,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { LIFTS, LiftKey, LIFT_COLOR, WorkoutLog, RepScheme } from '../../src/lib/types';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getLogs, deleteLog as deleteStoredLog } from '../../src/lib/storage';
import { confirmDestructive } from '../../src/lib/confirm';
import { GText } from '../../src/components/GText';
import { Heatmap } from '../../src/components/Heatmap';

const SCREEN_WIDTH = Dimensions.get('window').width;

const TOP_SET_PCT: Record<RepScheme, number> = {
  '555': 0.85,
  '333': 0.9,
  '531': 0.95,
  'deload': 0.60,
};

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function inferredTM(log: WorkoutLog): number {
  const topWeight = log.sets.reduce((m, s) => (s.weight > m ? s.weight : m), 0);
  const pct = TOP_SET_PCT[log.repScheme] ?? 0.85;
  return Math.round(topWeight / pct);
}

function relativeDate(iso: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const days = Math.round((now.getTime() - then.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatSectionDate(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase();
}

function dateFromKey(key: string): Date {
  return new Date(key + 'T12:00:00');
}

function liftName(key: LiftKey): string {
  return LIFTS.find((l) => l.key === key)?.name ?? key;
}

interface LogSection {
  title: string;
  dateKey: string;
  data: WorkoutLog[];
}

const MAX_AUTO_EXPAND = 5;

export default function LogScreen() {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const feedRef = useRef<SectionList<WorkoutLog>>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await getLogs());
    } catch (e) {
      console.error('Error loading logs:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const deleteLog = useCallback((id: string) => {
    confirmDestructive('Delete workout?', 'This cannot be undone.', async () => {
      try {
        setLogs(await deleteStoredLog(id));
      } catch (e) {
        Alert.alert('Error', 'Failed to delete workout');
      }
    });
  }, []);

  const editLog = useCallback((id: string) => {
    router.push(`/edit/${id}`);
  }, []);

  const { sections, visibleSections } = useMemo(() => {
    const sorted = [...logs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const groups = new Map<string, WorkoutLog[]>();
    for (const log of sorted) {
      const key = log.date.slice(0, 10);
      const arr = groups.get(key) ?? [];
      arr.push(log);
      groups.set(key, arr);
    }
    const rawSections: LogSection[] = [];
    for (const [dateKey, data] of groups) {
      rawSections.push({ title: formatSectionDate(dateKey), dateKey, data });
    }
    rawSections.sort(
      (a, b) => dateFromKey(b.dateKey).getTime() - dateFromKey(a.dateKey).getTime()
    );

    const visible = rawSections.map((s) =>
      expandedSections.has(s.dateKey) ? s : { ...s, data: [] }
    );

    return { sections: rawSections, visibleSections: visible };
  }, [logs, expandedSections]);

  useEffect(() => {
    if (expandedSections.size === 0 && sections.length > 0) {
      const next = new Set<string>();
      for (let i = 0; i < Math.min(sections.length, MAX_AUTO_EXPAND); i++) {
        next.add(sections[i].dateKey);
      }
      setExpandedSections(next);
    }
  }, [sections.length, expandedSections.size]);

  const sectionIndexByDate = useMemo(() => {
    const map = new Map<string, number>();
    sections.forEach((s, i) => map.set(s.dateKey, i));
    return map;
  }, [sections]);

  const toggleSection = (dateKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const handleDayTap = (dateKey: string) => {
    const sectionIndex = sectionIndexByDate.get(dateKey);
    if (sectionIndex == null) return;
    setExpandedSections((prev) => new Set([...prev, dateKey]));
    feedRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0.1,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SectionList
        ref={feedRef}
        style={styles.list}
        sections={visibleSections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SwipeableRow
            colors={colors}
            onEdit={() => editLog(item.id)}
            onDelete={() => deleteLog(item.id)}
          >
            <SessionCard log={item} colors={colors} />
          </SwipeableRow>
        )}
        renderSectionHeader={({ section }) => (
          <Pressable
            style={styles.sectionHeader}
            onPress={() => toggleSection(section.dateKey)}
          >
            <GText style={styles.sectionHeaderText}>
              {section.title}  ·  {sections.find((s) => s.dateKey === section.dateKey)?.data.length ?? 0} entry
              {(((sections.find((s) => s.dateKey === section.dateKey)?.data.length) ?? 0) !== 1) ? 'ies' : ''}
            </GText>
            <GText style={styles.sectionChevron}>
              {expandedSections.has(section.dateKey) ? '▾' : '▸'}
            </GText>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            feedRef.current?.scrollToLocation({
              sectionIndex: info.index as number,
              itemIndex: 0,
              animated: true,
              viewPosition: 0.1,
            });
          }, 100);
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <GText style={styles.title}>Progress</GText>
            </View>
            <View style={styles.heatmapWrap}>
              <Heatmap logs={logs} onDayTap={handleDayTap} />
            </View>
            <View style={styles.legend}>
              {LIFTS.map((l) => (
                <View key={l.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: LIFT_COLOR[l.key] }]} />
                  <GText style={styles.legendText}>{l.name}</GText>
                </View>
              ))}
            </View>
            <GText style={styles.sectionLabel}>Recent Sessions</GText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <GText style={styles.emptyText}>No workouts logged yet</GText>
          </View>
        }
        ListFooterComponent={
          <View>
            <Pressable
              style={styles.trendToggle}
              onPress={() => setShowTrend((v) => !v)}
            >
              <GText style={styles.trendToggleText}>
                {showTrend ? 'Hide trend ▴' : 'Show trend ▾'}
              </GText>
            </Pressable>
            {showTrend ? <TrendChart logs={logs} colors={colors} /> : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function SessionCard({ log, colors }: { log: WorkoutLog; colors: ThemeColors }) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const setsLine = log.sets.map((s) => `${s.weight}×${s.reps}`).join(' · ');
  return (
    <View style={styles.sessionCard}>
      <View style={[styles.accentStripe, { backgroundColor: LIFT_COLOR[log.liftKey] }]} />
      <View style={styles.sessionBody}>
        <View style={styles.sessionRow1}>
          <GText style={styles.sessionLift}>{liftName(log.liftKey)}</GText>
          <View style={styles.schemeBadge}>
            <GText style={styles.schemeText}>{log.repScheme}</GText>
          </View>
        </View>
        <View style={styles.sessionRow2}>
          <GText style={styles.sessionDate}>{relativeDate(log.date)}</GText>
          <GText style={styles.sessionSep}> · </GText>
          <GText style={styles.setsLine} numberOfLines={1}>
            {setsLine}
          </GText>
        </View>
        {log.notes ? (
          <GText style={styles.notesLine} numberOfLines={2}>
            ✎ {log.notes}
          </GText>
        ) : null}
      </View>
    </View>
  );
}

interface SwipeableRowProps {
  children: React.ReactNode;
  colors: ThemeColors;
  onEdit: () => void;
  onDelete: () => void;
}

type OpenState = 'closed' | 'left' | 'right';

const ACTION_WIDTH = 100;
const BUTTON_WIDTH = 150;
const SWIPE_THRESHOLD = 35;
const VELOCITY_THRESHOLD = 0.25;
const ACTIVATION_DX = 6;
const TAP_SLOP = 5;

function SwipeableRow({ children, colors, onEdit, onDelete }: SwipeableRowProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef<OpenState>('closed');

  const offsetFor = (s: OpenState): number =>
    s === 'left' ? -ACTION_WIDTH : s === 'right' ? ACTION_WIDTH : 0;

  const animateTo = useCallback(
    (s: OpenState) => {
      openRef.current = s;
      Animated.spring(translateX, {
        toValue: offsetFor(s),
        friction: 9,
        tension: 100,
        useNativeDriver: true,
      }).start();
    },
    [translateX]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim taps only when something is open (so tapping the card closes it).
        onStartShouldSetPanResponder: () => openRef.current !== 'closed',
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > ACTIVATION_DX && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > ACTIVATION_DX && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const base = offsetFor(openRef.current);
          const next = Math.max(
            -ACTION_WIDTH * 1.15,
            Math.min(ACTION_WIDTH * 1.15, base + g.dx)
          );
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          const prev = openRef.current;
          const isTap = Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP;
          if (isTap && prev !== 'closed') {
            animateTo('closed');
            return;
          }
          if (prev === 'closed') {
            if (g.dx < -SWIPE_THRESHOLD || g.vx < -VELOCITY_THRESHOLD) animateTo('left');
            else if (g.dx > SWIPE_THRESHOLD || g.vx > VELOCITY_THRESHOLD) animateTo('right');
            else animateTo('closed');
          } else if (prev === 'left') {
            if (g.dx > SWIPE_THRESHOLD || g.vx > VELOCITY_THRESHOLD) animateTo('closed');
            else animateTo('left');
          } else {
            if (g.dx < -SWIPE_THRESHOLD || g.vx < -VELOCITY_THRESHOLD) animateTo('closed');
            else animateTo('right');
          }
        },
        onPanResponderTerminate: () => animateTo(openRef.current),
      }),
    [translateX, animateTo]
  );

  return (
    <View style={styles.swipeContainer}>
      <Pressable
        style={[styles.swipeActionAbs, styles.swipeEdit, { left: 0 }]}
        onPress={() => {
          animateTo('closed');
          onEdit();
        }}
      >
        <View style={[styles.swipeActionContent, { left: 0 }]}>
          <Ionicons name="pencil" size={20} color={colors.background} />
          <GText style={styles.swipeActionText}>Edit</GText>
        </View>
      </Pressable>
      <Pressable
        style={[styles.swipeActionAbs, styles.swipeDelete, { right: 0 }]}
        onPress={() => {
          animateTo('closed');
          onDelete();
        }}
      >
        <View style={[styles.swipeActionContent, { right: 0 }]}>
          <Ionicons name="trash" size={20} color="#fff" />
          <GText style={[styles.swipeActionText, { color: '#fff' }]}>Delete</GText>
        </View>
      </Pressable>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function TrendChart({ logs, colors }: { logs: WorkoutLog[]; colors: ThemeColors }) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const allDates = Array.from(
    new Set(logs.map((l) => l.date.slice(0, 10)))
  ).sort();

  if (allDates.length < 2) {
    return (
      <View style={styles.trendEmpty}>
        <GText style={styles.emptyText}>Log at least two workouts to see a trend</GText>
      </View>
    );
  }

  const datasets = LIFTS.map((l) => {
    const byDate = new Map<string, number>();
    logs
      .filter((log) => log.liftKey === l.key)
      .forEach((log) => {
        const k = log.date.slice(0, 10);
        byDate.set(k, inferredTM(log));
      });
    let last = NaN;
    const firstDate = allDates.find((d) => byDate.has(d));
    const data = allDates.map((d) => {
      if (byDate.has(d)) {
        last = byDate.get(d)!;
        return last;
      }
      if (firstDate && d > firstDate) return last;
      return NaN;
    });
    return { data, color: () => LIFT_COLOR[l.key], strokeWidth: 2 };
  });

  const width = SCREEN_WIDTH - 40;
  const height = 220;

  return (
    <View style={styles.trendCard}>
      <LineChart
        data={{
          labels: allDates.map(formatShort),
          datasets,
        }}
        width={width}
        height={height}
        chartConfig={{
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => hexToRgba(colors.textSecondary, opacity),
          labelColor: (opacity = 1) => hexToRgba(colors.textSecondary, opacity),
          propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '' },
          propsForLabels: { fontFamily: 'RobotoCondensed_500Medium', fontSize: 11 },
          propsForDots: { r: '3', strokeWidth: '0' },
          strokeWidth: 2,
        }}
        bezier
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels={false}
        withHorizontalLabels
        withShadow={false}
        style={styles.trendChart}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 60,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.5,
    },
    heatmapWrap: {
      paddingVertical: 4,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 24,
      marginBottom: 10,
      paddingHorizontal: 24,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    swipeContainer: {
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: 14,
      overflow: 'hidden',
    },
    swipeActionAbs: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: BUTTON_WIDTH,
    },
    swipeEdit: {
      backgroundColor: colors.primary,
    },
    swipeDelete: {
      backgroundColor: colors.error,
    },
    swipeActionContent: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: ACTION_WIDTH,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    swipeActionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.background,
      letterSpacing: 0.5,
    },
    sessionCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    accentStripe: {
      width: 4,
    },
    sessionBody: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 4,
    },
    sessionRow1: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sessionRow2: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sessionLift: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    sessionDate: {
      fontSize: 12,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    sessionSep: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    setsLine: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    schemeBadge: {
      paddingHorizontal: 9,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    schemeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    notesLine: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginTop: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 10,
      marginTop: 6,
      backgroundColor: colors.background,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionChevron: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    trendToggle: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 18,
      marginTop: 18,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    trendToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    trendCard: {
      marginHorizontal: 20,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      alignItems: 'center',
    },
    trendChart: {
      borderRadius: 12,
    },
    trendEmpty: {
      alignItems: 'center',
      paddingVertical: 30,
      marginHorizontal: 20,
      marginBottom: 20,
    },
  });
