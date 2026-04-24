// GitHub-style contribution heatmap of workouts.
//
// Layout: 53 columns × 7 rows of little squares. Each column is one week,
// each row is a weekday (Mon–Sun). We render the most recent 53 weeks
// ending on today, then auto-scroll to the right edge so "today" is in
// view.
//
// A day's square is:
//   - empty (surface color) if no workout
//   - a solid colored square if one lift was trained that day
//   - a 2×2 quadrant grid if multiple lifts were trained, with the lift's
//     color in its quadrant or the border color if absent. The quadrant
//     positions are fixed (squat/bench/deadlift/ohp in reading order) so
//     the same lift is always in the same corner across days.

import { useMemo, useRef } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LiftKey, LIFT_COLOR, WorkoutLog } from '../lib/types';
import { useTheme, ThemeColors } from '../lib/theme';
import { GText } from './GText';

const CELL = 14;
const GAP = 3;
const WEEKS = 53;
const ROWS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUADRANT_ORDER: LiftKey[] = ['squat', 'bench', 'deadlift', 'ohp'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function mondayOf(d: Date): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  return addDays(x, -diff);
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface HeatmapProps {
  logs: WorkoutLog[];
  onDayTap?: (dateKey: string) => void;
}

export function Heatmap({ logs, onDayTap }: HeatmapProps) {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const { byDate, weeks, monthLabels, today } = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = addDays(mondayOf(today), -(WEEKS - 1) * 7);

    const byDate = new Map<string, Set<LiftKey>>();
    for (const log of logs) {
      const k = log.date.slice(0, 10);
      const s = byDate.get(k) ?? new Set<LiftKey>();
      s.add(log.liftKey);
      byDate.set(k, s);
    }

    const weeks: { col: number; dates: Date[] }[] = [];
    for (let col = 0; col < WEEKS; col++) {
      const dates: Date[] = [];
      for (let row = 0; row < ROWS; row++) {
        dates.push(addDays(startDate, col * 7 + row));
      }
      weeks.push({ col, dates });
    }

    const monthLabels: { col: number; label: string }[] = [];
    let prevMonth = -1;
    for (let col = 0; col < WEEKS; col++) {
      const m = weeks[col].dates[0].getMonth();
      if (m !== prevMonth) {
        monthLabels.push({ col, label: MONTHS[m] });
        prevMonth = m;
      }
    }

    return { byDate, weeks, monthLabels, today };
  }, [logs]);

  const totalWidth = WEEKS * CELL + (WEEKS - 1) * GAP;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      contentContainerStyle={styles.scroll}
    >
      <View>
        <View style={[styles.monthRow, { width: totalWidth }]}>
          {monthLabels.map(({ col, label }) => (
            <GText
              key={`${col}-${label}`}
              style={[styles.monthLabel, { left: col * (CELL + GAP) }]}
            >
              {label}
            </GText>
          ))}
        </View>
        <View style={styles.grid}>
          {weeks.map(({ col, dates }) => (
            <View key={col} style={styles.col}>
              {dates.map((d, row) => {
                const key = dateKey(d);
                const isFuture = d.getTime() > today.getTime();
                const lifts = byDate.get(key);
                return (
                  <DayCell
                    key={row}
                    isFuture={isFuture}
                    lifts={lifts}
                    onTap={lifts && onDayTap ? () => onDayTap(key) : undefined}
                    colors={colors}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function DayCell({
  isFuture,
  lifts,
  onTap,
  colors,
}: {
  isFuture: boolean;
  lifts?: Set<LiftKey>;
  onTap?: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (isFuture) {
    return <View style={styles.cellFuture} />;
  }

  let inner: React.ReactNode;
  if (!lifts || lifts.size === 0) {
    inner = <View style={[styles.cell, { backgroundColor: colors.surface }]} />;
  } else if (lifts.size === 1) {
    const key = Array.from(lifts)[0];
    inner = <View style={[styles.cell, { backgroundColor: LIFT_COLOR[key] }]} />;
  } else {
    inner = (
      <View style={styles.quadCell}>
        {QUADRANT_ORDER.map((k) => (
          <View
            key={k}
            style={{
              width: CELL / 2,
              height: CELL / 2,
              backgroundColor: lifts.has(k) ? LIFT_COLOR[k] : colors.border,
            }}
          />
        ))}
      </View>
    );
  }

  if (onTap) {
    return (
      <Pressable onPress={onTap} hitSlop={4}>
        {inner}
      </Pressable>
    );
  }
  return <>{inner}</>;
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: 20,
    },
    monthRow: {
      height: 16,
      marginBottom: 4,
      position: 'relative',
    },
    monthLabel: {
      position: 'absolute',
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    grid: {
      flexDirection: 'row',
      gap: GAP,
    },
    col: {
      gap: GAP,
    },
    cell: {
      width: CELL,
      height: CELL,
      borderRadius: 3,
    },
    cellFuture: {
      width: CELL,
      height: CELL,
    },
    quadCell: {
      width: CELL,
      height: CELL,
      borderRadius: 3,
      overflow: 'hidden',
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
  });