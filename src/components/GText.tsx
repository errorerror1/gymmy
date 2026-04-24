// Drop-in replacement for <Text>. Applies the right Roboto Condensed
// font variant based on the fontWeight in the passed style. React Native
// can't actually *bold* a variable font on its own, so we have to pick
// the correct pre-compiled family (400 / 500 / 700) manually.
//
// Use this anywhere you'd otherwise use <Text>. Its sibling GTextInput
// does the same for <TextInput>.

import { Text, TextProps, StyleSheet } from 'react-native';

function familyFor(weight: unknown): string {
  const w = typeof weight === 'number' ? String(weight) : weight;
  if (w === 'bold' || w === '700' || w === '800' || w === '900') {
    return 'RobotoCondensed_700Bold';
  }
  if (w === '500' || w === '600') {
    return 'RobotoCondensed_500Medium';
  }
  return 'RobotoCondensed_400Regular';
}

export function GText({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const fontFamily = familyFor((flat as { fontWeight?: unknown }).fontWeight);
  return <Text {...rest} style={[style, { fontFamily }]} />;
}
