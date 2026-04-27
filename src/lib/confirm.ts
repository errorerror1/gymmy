// Cross-platform destructive confirmation. Alert.alert with multiple
// buttons is a no-op on react-native-web (the destructive onPress never
// fires), so on web we drop down to the browser's native window.confirm.

import { Alert, Platform } from 'react-native';

export function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel: string = 'Delete'
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
