// Drag-to-edit Training Max widget.
//
// The interaction is: press and hold for ~1 second to "arm" the value,
// then drag up/down to change it in +/- increments of 5 lb (or 2.5 kg).
// Release commits. We need this flow because the parent ScrollView is
// paging horizontally and also scrolling vertically — a plain drag would
// always be claimed by the scroll view first.
//
// Key pieces:
//  - We use the raw React Native responder system (onStartShouldSetResponder
//    + onResponderMove) rather than PanResponder because we want to claim the
//    gesture up front on press, not after a movement threshold is crossed.
//  - While armed we call `onArmedChange(true)` so the parent can disable
//    its ScrollViews; the drag only "wins" because scrolling is off.
//  - Refs mirror every prop read inside the long-lived responder callbacks
//    (tm, increment, onArmedChange). If we read the props directly the
//    callbacks would close over stale values captured when the responder
//    first attached.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Unit } from '../lib/types';
import { ThemeColors } from '../lib/theme';
import { GText } from './GText';

const DRAG_PX_PER_STEP = 12;
const ARM_DELAY_MS = 1000;

function formatWeightValue(v: number, unit: Unit): string {
  return unit === 'kg' ? v.toFixed(1) : v.toFixed(0);
}

interface Props {
  tm: number;
  unit: Unit;
  increment: number;
  onChange: (v: number) => void;
  onArmedChange?: (armed: boolean) => void;
  colors: ThemeColors;
}

export function TMDragValue({ tm, unit, increment, onChange, onArmedChange, colors }: Props) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [armed, setArmed] = useState(false);
  const [dragTM, setDragTM] = useState<number | null>(null);

  // Imperative state — these must not trigger re-renders during a drag.
  const armedRef = useRef(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startYRef = useRef(0);
  const startTMRef = useRef(tm);
  const latestTMRef = useRef(tm);

  // Mirror props into refs so the responder callbacks always see the latest
  // values (see comment at the top of the file).
  const tmRef = useRef(tm);
  const incrementRef = useRef(increment);
  const onArmedChangeRef = useRef(onArmedChange);
  tmRef.current = tm;
  incrementRef.current = increment;
  onArmedChangeRef.current = onArmedChange;

  const scale = useRef(new Animated.Value(1)).current;

  // Clean up the arm timer if the component unmounts mid-press.
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );

  const arm = () => {
    armedRef.current = true;
    setArmed(true);
    onArmedChangeRef.current?.(true);
    startTMRef.current = tmRef.current;
    latestTMRef.current = tmRef.current;
    setDragTM(tmRef.current);
    Animated.spring(scale, {
      toValue: 1.15,
      friction: 5,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const reset = () => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    const wasArmed = armedRef.current;
    armedRef.current = false;
    setArmed(false);
    setDragTM(null);
    if (wasArmed) onArmedChangeRef.current?.(false);
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[styles.dragArea, { transform: [{ scale }] }]}
      onStartShouldSetResponder={(e) => {
        startYRef.current = e.nativeEvent.pageY;
        if (armTimer.current) clearTimeout(armTimer.current);
        armTimer.current = setTimeout(arm, ARM_DELAY_MS);
        return true;
      }}
      onResponderMove={(e) => {
        if (!armedRef.current) return;
        // Up is negative in screen coordinates; invert so dragging up increases TM.
        const dy = e.nativeEvent.pageY - startYRef.current;
        const steps = Math.round(-dy / DRAG_PX_PER_STEP);
        const next = Math.max(0, startTMRef.current + steps * incrementRef.current);
        latestTMRef.current = next;
        setDragTM(next);
      }}
      onResponderRelease={() => {
        if (armedRef.current && latestTMRef.current !== startTMRef.current) {
          onChange(latestTMRef.current);
        }
        reset();
      }}
      onResponderTerminate={reset}
      // Once armed, don't let the parent ScrollView steal the gesture back.
      onResponderTerminationRequest={() => !armedRef.current}
    >
      <View style={styles.valueRow}>
        <GText selectable={false} style={[styles.value, armed && styles.valueArmed]}>
          {formatWeightValue(dragTM ?? tm, unit)}
        </GText>
        <GText selectable={false} style={[styles.unit, armed && styles.valueArmed]}>
          {unit}
        </GText>
      </View>
      <GText style={[styles.hint, armed && styles.hintArmed]}>
        {armed ? '↕ drag to adjust' : 'hold to edit'}
      </GText>
    </Animated.View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dragArea: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
    },
    value: {
      fontSize: 48,
      fontWeight: '700',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      fontSize: 22,
      fontWeight: '500',
      color: colors.textSecondary,
      marginLeft: 8,
    },
    valueArmed: {
      color: colors.primary,
    },
    hint: {
      fontSize: 12,
      marginTop: 6,
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    hintArmed: {
      color: colors.primary,
    },
  });
