import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Asks for biometrics (or the device passcode) before sensitive actions.
 * Devices with no lock screen configured can't be challenged, so we allow the action.
 */
export async function confirmWithBiometrics(reason: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return true;
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
