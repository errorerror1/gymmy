// Settings tab. Plain list of toggles: unit (lb/kg), appearance
// (auto/light/dark), backup (Export/Import), and destructive Clear.
//
// Dark mode writes through the ThemeProvider (which also handles the
// in-memory switch); every other setting goes through src/lib/storage.ts.

import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Alert, Platform, ScrollView, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Unit, DarkMode, AppSettings } from '../../src/lib/types';
import { useTheme, useThemeMode, ThemeColors } from '../../src/lib/theme';
import {
  getSettings,
  patchSettings,
  clearAll,
  exportAll,
  importAll,
  DEFAULT_SETTINGS,
} from '../../src/lib/storage';
import { GText } from '../../src/components/GText';

export default function SettingsScreen() {
  const colors = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { mode: darkMode, setMode: setDarkMode } = useThemeMode();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getSettings());
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const updateUnit = async (unit: Unit) => {
    setSettings((s) => ({ ...s, unit }));
    try {
      await patchSettings({ unit });
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const updateDarkMode = async (mode: DarkMode) => {
    // Theme provider owns the in-memory mode and writes the settings blob itself.
    setDarkMode(mode);
    setSettings((s) => ({ ...s, darkMode: mode }));
  };

  const clearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your workout logs and settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            Alert.alert('Done', 'All data cleared');
          },
        },
      ]
    );
  };

  // Export/import are web-only today: they rely on the browser's <a download>
  // and <input type="file"> to move a JSON file in or out. On native we'd need
  // expo-file-system + expo-sharing + expo-document-picker.
  const handleExport = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not available', 'Export is currently only supported on web.');
      return;
    }
    try {
      const backup = await exportAll();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `gymtracker-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleImport = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not available', 'Import is currently only supported on web.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const doImport = async () => {
        try {
          const text = await file.text();
          const payload = JSON.parse(text);
          await importAll(payload);
          await loadSettings();
          Alert.alert('Restored', 'Backup imported. Reload the app to see all updates.');
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          Alert.alert('Import failed', msg);
        }
      };
      // Confirm before overwriting existing local data.
      if (typeof window !== 'undefined' && !window.confirm('Replace current data with this backup?')) {
        return;
      }
      doImport();
    };
    input.click();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GText style={styles.title}>Settings</GText>

        <View style={styles.section}>
        <GText style={styles.sectionTitle}>Units</GText>
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleOption, settings.unit === 'lb' && styles.toggleOptionActive]}
            onPress={() => updateUnit('lb')}
          >
            <GText style={[styles.toggleText, settings.unit === 'lb' && styles.toggleTextActive]}>
              Pounds (lb)
            </GText>
          </Pressable>
          <Pressable
            style={[styles.toggleOption, settings.unit === 'kg' && styles.toggleOptionActive]}
            onPress={() => updateUnit('kg')}
          >
            <GText style={[styles.toggleText, settings.unit === 'kg' && styles.toggleTextActive]}>
              Kilograms (kg)
            </GText>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <GText style={styles.sectionTitle}>Appearance</GText>
        <View style={styles.toggle}>
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.toggleOption, darkMode === m && styles.toggleOptionActive]}
              onPress={() => updateDarkMode(m)}
            >
              <GText style={[styles.toggleText, darkMode === m && styles.toggleTextActive]}>
                {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
              </GText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <GText style={styles.sectionTitle}>Backup</GText>
        <GText style={styles.helpText}>
          Export a JSON file of all your workouts, training maxes, and settings.
          Import it on another device or browser to restore.
        </GText>
        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={handleExport}>
            <GText style={styles.secondaryText}>Export</GText>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleImport}>
            <GText style={styles.secondaryText}>Import</GText>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <GText style={styles.sectionTitle}>Data</GText>
        <Pressable style={styles.dangerButton} onPress={clearData}>
          <GText style={styles.dangerText}>Clear All Data</GText>
        </Pressable>
      </View>

      <View style={styles.section}>
        <GText style={styles.sectionTitle}>About</GText>
        <GText style={styles.helpText}>
          Gymmy stores your workouts locally on this device. Nothing is
          sent to any server.
        </GText>
        <Pressable onPress={() => Linking.openURL('mailto:dsvit@proton.me')}>
          <GText style={styles.linkText}>dsvit@proton.me</GText>
        </Pressable>
      </View>

        <View style={styles.footer}>
          <GText style={styles.footerText}>Gymmy v1.0</GText>
        </View>
      </ScrollView>
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
    scrollContent: {
      padding: 24,
      flexGrow: 1,
    },
    title: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 32,
    },
    section: {
      padding: 20,
      borderRadius: 16,
      marginBottom: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      color: colors.text,
    },
    toggle: {
      flexDirection: 'row',
      gap: 10,
    },
    toggleOption: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    toggleOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleText: {
      fontWeight: '600',
      fontSize: 15,
      color: colors.textSecondary,
    },
    toggleTextActive: {
      color: colors.background,
    },
    helpText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      marginBottom: 14,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    secondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    linkText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    dangerButton: {
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      alignItems: 'center',
    },
    dangerText: {
      color: colors.error,
      fontWeight: '600',
      fontSize: 15,
    },
    footer: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 20,
    },
    footerText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });