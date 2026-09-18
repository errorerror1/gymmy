// Imperative toast. Alert.alert is a silent no-op on react-native-web,
// so every informational message ("Saved", errors, hints) goes through
// this instead: call toast('…') from anywhere, ToastHost (mounted once
// in the root layout) renders it as an auto-dismissing pill.

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { GText } from './GText';
import { useTheme } from '../lib/theme';

type Listener = (msg: string) => void;
let listener: Listener | null = null;

export function toast(msg: string): void {
  listener?.(msg);
}

export function ToastHost() {
  const colors = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (m) => {
      setMsg(m);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 240, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setMsg(null);
          }
        );
      }, 2200);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!msg) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.pill, { opacity, backgroundColor: colors.text }]}>
        <GText style={[styles.text, { color: colors.background }]}>{msg}</GText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    maxWidth: '86%',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
