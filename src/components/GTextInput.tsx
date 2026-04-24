// See GText.tsx for the full explanation — this is the same pattern
// applied to TextInput instead of Text.

import { TextInput, TextInputProps, StyleSheet } from 'react-native';

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

export function GTextInput({ style, ...rest }: TextInputProps) {
  const flat = StyleSheet.flatten(style) || {};
  const fontFamily = familyFor((flat as { fontWeight?: unknown }).fontWeight);
  return <TextInput {...rest} style={[style, { fontFamily }]} />;
}
