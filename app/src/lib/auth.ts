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

/** Recovery secrets require a new biometric challenge; never silently bypass it. */
export async function confirmRecoveryReveal(): Promise<boolean> {
  if (Platform.OS === 'web') {
    throw new Error('Open Arclet on your phone to reveal your recovery phrase with device biometrics.');
  }
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !enrolled) {
    throw new Error('Set up fingerprint or Face ID in your device settings, then try again.');
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Show recovery phrase',
    promptDescription: 'Verify it’s you before showing your wallet’s recovery phrase.',
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
    fallbackLabel: '',
    biometricsSecurityLevel: 'strong',
    requireConfirmation: true,
  });
  if (!result.success && !['user_cancel', 'app_cancel', 'system_cancel'].includes(result.error)) {
    throw new Error('Biometric verification didn’t complete. Try again with fingerprint or Face ID.');
  }
  return result.success;
}
