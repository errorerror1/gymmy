// Root layout — sits above the tabs and the edit modal. Responsibilities:
//
//   1. Load the Roboto Condensed font before rendering (so the first paint
//      doesn't use the system fallback and re-flow once the font arrives).
//   2. Install the PWA-related <meta> and <link> tags at runtime. Expo
//      Router owns index.html, so we can't edit it directly; injecting
//      from an effect is the simplest way to add them.
//   3. Register the service worker so the app is available offline once
//      it has been loaded once.
//   4. Wrap everything in SafeAreaProvider + ThemeProvider and declare the
//      two top-level routes: the tab stack and the edit modal.

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  RobotoCondensed_400Regular,
  RobotoCondensed_500Medium,
  RobotoCondensed_700Bold,
} from '@expo-google-fonts/roboto-condensed';
import { ThemeProvider } from '../src/lib/theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_500Medium,
    RobotoCondensed_700Bold,
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Inject manifest link
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Theme color
    let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = '#8B7355';

    // Apple PWA meta tags
    const appleMeta = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'GymTracker' },
    ];
    appleMeta.forEach(({ name, content }) => {
      let m = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!m) {
        m = document.createElement('meta');
        m.name = name;
        document.head.appendChild(m);
      }
      m.content = content;
    });
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .catch((err) => {
          console.warn('Service worker registration failed:', err);
        });
    }
  }, []);

  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="edit/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
