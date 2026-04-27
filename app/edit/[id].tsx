// Edit-log modal. Presented with `presentation: 'modal'` from the root
// layout, so on iOS it slides up from the bottom. Entered from the Log
// tab via router.push(`/edit/${id}`). On a tab change or `router.back()`
// the modal unwinds and the Log tab reloads on focus.

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LIFTS, LIFT_COLOR, WorkoutLog } from '../../src/lib/types';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getLogs, updateLogSets, deleteLog } from '../../src/lib/storage';
import { confirmDestructive } from '../../src/lib/confirm';
import { GText } from '../../src/components/GText';
import { GTextInput } from '../../src/components/GTextInput';

interface SetDraft {
  weight: string;
  reps: string;
}

export default function EditLogScreen() {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [drafts, setDrafts] = useState<SetDraft[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const logs = await getLogs();
        const found = logs.find((l) => l.id === id);
        if (!found) {
          setNotFound(true);
          return;
        }
        setLog(found);
        setDrafts(
          found.sets.map((s) => ({ weight: String(s.weight), reps: String(s.reps) }))
        );
      } catch {
        setNotFound(true);
      }
    })();
  }, [id]);

  const updateDraft = (i: number, field: keyof SetDraft, value: string) => {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value.replace(/[^0-9.]/g, '') } : d))
    );
  };

  const handleSave = async () => {
    if (!log) return;
    const sets = drafts.map((d) => ({
      weight: Number(d.weight) || 0,
      reps: Number(d.reps) || 0,
    }));
    try {
      await updateLogSets(log.id, sets);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleDelete = () => {
    if (!log) return;
    confirmDestructive('Delete workout?', 'This cannot be undone.', async () => {
      try {
        await deleteLog(log.id);
        router.back();
      } catch {
        Alert.alert('Error', 'Failed to delete workout');
      }
    });
  };

  if (notFound) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <GText style={styles.title}>Not found</GText>
          <View style={{ width: 28 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (!log) {
    return <SafeAreaView style={styles.container} edges={['top']} />;
  }

  const liftName = LIFTS.find((l) => l.key === log.liftKey)?.name ?? log.liftKey;
  const color = LIFT_COLOR[log.liftKey];
  const dateLabel = new Date(log.date).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <GText style={styles.title}>Edit</GText>
          <Pressable onPress={handleSave} hitSlop={10}>
            <GText style={styles.saveText}>Save</GText>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.liftRow}>
            <View style={[styles.liftDot, { backgroundColor: color }]} />
            <GText style={styles.liftName}>{liftName}</GText>
            <View style={styles.schemeBadge}>
              <GText style={styles.schemeText}>{log.repScheme}</GText>
            </View>
          </View>
          <GText style={styles.date}>{dateLabel}</GText>

          <GText style={styles.sectionLabel}>Sets</GText>
          <View style={styles.setsList}>
            {drafts.map((d, i) => (
              <View key={i} style={styles.setRow}>
                <GText style={styles.setLabel}>Set {i + 1}</GText>
                <View style={styles.setInputs}>
                  <GTextInput
                    style={styles.setInput}
                    value={d.weight}
                    onChangeText={(v) => updateDraft(i, 'weight', v)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <GText style={styles.setSep}>×</GText>
                  <GTextInput
                    style={styles.setInput}
                    value={d.reps}
                    onChangeText={(v) => updateDraft(i, 'reps', v)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <GText style={styles.deleteText}>Delete Workout</GText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    saveText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    liftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    liftDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    liftName: {
      flex: 1,
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    schemeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    schemeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    date: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
      letterSpacing: 0.5,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 28,
      marginBottom: 12,
    },
    setsList: {
      gap: 10,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    setLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    setInputs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    setInput: {
      width: 80,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    setSep: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 40,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    deleteText: {
      color: colors.error,
      fontWeight: '600',
      fontSize: 15,
    },
  });
