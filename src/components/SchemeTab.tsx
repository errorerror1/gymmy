// A single 555 / 333 / 531 / deload tab label.
// The animation is the only real complexity here: when the tab becomes
// active it springs up to 1.18× scale, back to 1.0 when deselected. We
// use the native driver so the animation runs off the JS thread.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleProp, TextStyle } from 'react-native';
import { RepScheme } from '../lib/types';
import { GText } from './GText';

interface Props {
  scheme: RepScheme;
  active: boolean;
  onPress: () => void;
  textStyle: StyleProp<TextStyle>;
  activeTextStyle: StyleProp<TextStyle>;
}

export function SchemeTab({ scheme, active, onPress, textStyle, activeTextStyle }: Props) {
  const scale = useRef(new Animated.Value(active ? 1.18 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.18 : 1,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  return (
    <Pressable onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <GText style={[textStyle, active && activeTextStyle]}>{scheme}</GText>
      </Animated.View>
    </Pressable>
  );
}
