import { Alert, Platform } from 'react-native';

/**
 * Pide confirmación antes de algo que no se puede deshacer (borrar).
 * En la versión web (PWA) Alert no muestra botones, así que se usa window.confirm.
 */
export function confirmDanger(title: string, message: string, action = 'Eliminar'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
