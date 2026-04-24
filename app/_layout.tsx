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
import { ThemeProvider, useThemeMode } from '../src/lib/theme';

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

    // iOS home-screen icon. Without this, iOS falls back to a screenshot of
    // the page — explicit apple-touch-icon gives a crisp icon at 180x180.
    let touchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!touchIcon) {
      touchIcon = document.createElement('link');
      touchIcon.rel = 'apple-touch-icon';
      document.head.appendChild(touchIcon);
    }
    touchIcon.href = '/icon/apple-touch-icon.png';

    // Viewport — must include viewport-fit=cover so env(safe-area-inset-top)
    // reports the real iPhone status bar height in PWA standalone mode.
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';

    // Apple PWA meta tags. `black-translucent` makes the iOS status bar
    // transparent so the app's own background (dark or light) shows through,
    // instead of the default white strip.
    const appleMeta = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Gymmy' },
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
        <MetaTags />
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

// Keeps <meta name="theme-color"> in sync with the active theme so Safari
// chrome and PWA headers pick up the real background instead of a fixed
// brown. Must live inside ThemeProvider to read the resolved theme.
function MetaTags() {
  const { resolved } = useThemeMode();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const bg = resolved === 'dark' ? '#0F0F0F' : '#F5F5F5';

    let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = bg;

    // Paint the root elements so the iPhone home-indicator safe area and any
    // other gap outside the React tree inherits the theme background instead
    // of the browser default white.
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [resolved]);
  return null;
}
