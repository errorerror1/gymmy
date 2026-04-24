// Free-text "accessory lifts" card under the working sets.
//
// UX pattern: the card is read-only until tapped. Tapping swaps it for a
// multiline input, which commits on blur. We keep a local `buffer` so
// typing stays snappy without hitting storage on every keystroke; the
// parent-owned `value` only gets touched once on commit.

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ThemeColors } from '../lib/theme';
import { GText } from './GText';
import { GTextInput } from './GTextInput';

interface Props {
  value: string;
  onSave: (text: string) => void;
  colors: ThemeColors;
}

export function AssistNotes({ value, onSave, colors }: Props) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [buffer, setBuffer] = useState(value);

  // Sync the buffer with the prop while not editing, so swiping to another
  // lift and back shows the latest saved value.
  useEffect(() => {
    if (!editing) setBuffer(value);
  }, [value, editing]);

  const commit = () => {
    onSave(buffer);
    setEditing(false);
  };

  if (editing) {
    return (
      <GTextInput
        style={styles.input}
        value={buffer}
        onChangeText={setBuffer}
        onBlur={commit}
        multiline
        autoFocus
        textAlignVertical="top"
        placeholder="Accessory lifts, sets, notes…"
        placeholderTextColor={colors.textSecondary}
      />
    );
  }

  const isEmpty = value.trim().length === 0;

  return (
    <Pressable onPress={() => setEditing(true)} style={styles.card}>
      <GText style={[styles.text, isEmpty && styles.placeholder]}>
        {isEmpty ? 'Tap to add accessory lifts, sets, notes…' : value}
      </GText>
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      minHeight: 80,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    placeholder: {
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    input: {
      minHeight: 80,
      paddingTop: 14,
      paddingBottom: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
  });
