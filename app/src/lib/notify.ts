import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL = 'payments';
let ready: Promise<boolean> | null = null;

/** Sets up the foreground handler + Android channel and asks for permission once. */
export function initNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  ready ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 120, 80, 120],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  })();
  return ready;
}

export async function notifyLocal(title: string, body: string, url?: string) {
  if (!(await initNotifications())) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: url ? { url } : undefined },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}
