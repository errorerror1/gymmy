// Theme provider — owns the light/dark color palette and responds to both
// the OS color scheme (when mode === 'auto') and manual user override.
//
// The provider reads `darkMode` from the settings blob on mount and writes
// back there when the user toggles it in Settings. We intentionally keep
// this separate from src/lib/storage.ts to avoid an import cycle: this
// file is imported by almost every screen, so it needs to stay lightweight.
//
// Consumers:
//   useTheme()     → palette only (most common case)
//   useThemeMode() → current mode + setter (used by Settings tab)

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkMode } from './types';

const SETTINGS_KEY = 'gymtracker_settings';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryDark: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  inactiveTab: string;
}

export const darkTheme: ThemeColors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#222222',
  primary: '#D4C4A8',
  primaryDark: '#B8A88C',
  text: '#F5F5F5',
  textSecondary: '#9CA3AF',
  border: '#2A2A2A',
  success: '#10B981',
  error: '#EF4444',
  inactiveTab: '#6B7280',
};

export const lightTheme: ThemeColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F0F0',
  primary: '#8B7355',
  primaryDark: '#6B5A45',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  border: '#E5E5E5',
  success: '#059669',
  error: '#DC2626',
  inactiveTab: '#9CA3AF',
};

interface ThemeContextValue {
  colors: ThemeColors;
  mode: DarkMode;
  setMode: (mode: DarkMode) => void;
  resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkTheme,
  mode: 'auto',
  setMode: () => {},
  resolved: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<DarkMode>('auto');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((data) => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.darkMode) {
            setModeState(parsed.darkMode);
          }
        } catch {
          // ignore parse errors
        }
      }
    });
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const resolved = mode === 'auto' ? systemTheme : mode;

  const colors = useMemo(() => (resolved === 'light' ? lightTheme : darkTheme), [resolved]);

  const setMode = useCallback(
    async (next: DarkMode) => {
      setModeState(next);
      try {
        const data = await AsyncStorage.getItem(SETTINGS_KEY);
        const settings = data ? JSON.parse(data) : {};
        settings.darkMode = next;
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // ignore
      }
    },
    []
  );

  const value = useMemo(
    () => ({ colors, mode, setMode, resolved }),
    [colors, mode, setMode, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode' | 'resolved'> {
  const ctx = useContext(ThemeContext);
  return { mode: ctx.mode, setMode: ctx.setMode, resolved: ctx.resolved };
}


