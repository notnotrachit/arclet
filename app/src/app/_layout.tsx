import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { BrandLoading } from '@/ui/Brand';
import { AppearanceProvider } from '@/state/appearance';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { parsePaymentUri } from '@/lib/payments';
import { openPayRequest } from '@/lib/routing';
import { ActivityProvider } from '@/state/activity';
import { ContactsProvider } from '@/state/contacts';
import { GroupsProvider } from '@/state/groups';
import { ToastProvider } from '@/state/toast';
import { useWallet, WalletProvider } from '@/state/wallet';
import { useTheme } from '@/ui/theme';
import { MotionProvider } from '@/ui/motion';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({ duration: 350, fade: true });
}

function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);
}

/**
 * Safety net for cold starts from an NFC tap / link: the wallet loads asynchronously, so if the router
 * didn't land on /pay by itself once the wallet is ready, open the request manually.
 */
function useColdStartPayLink(ready: boolean) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current || Platform.OS === 'web') return;
    handled.current = true;
    Linking.getInitialURL().then((url) => {
      const req = url ? parsePaymentUri(url) : null;
      if (!req) return;
      setTimeout(() => {
        if (!pathRef.current.startsWith('/pay')) openPayRequest(req);
      }, 400);
    });
  }, [ready]);
}

function RootStack() {
  const { colors } = useTheme();
  const { status } = useWallet();
  useNotificationTaps();
  useColdStartPayLink(status === 'ready');
  useEffect(() => {
    if (status !== 'loading' && Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') {
    return <BrandLoading />;
  }

  const hasWallet = status === 'ready';
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
      }}>
      <Stack.Protected guard={!hasWallet}>
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/import" options={{ title: 'Import wallet' }} />
      </Stack.Protected>
      <Stack.Protected guard={hasWallet}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pay" options={{ title: 'Send money', presentation: 'modal' }} />
        <Stack.Screen name="receive" options={{ title: 'Request payment' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan QR', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="tap" options={{ title: 'Tap to pay', presentation: 'modal' }} />
        <Stack.Screen name="backup" options={{ title: 'Recovery phrase' }} />
        <Stack.Screen name="contact/new" options={{ title: 'New contact', presentation: 'modal' }} />
        <Stack.Screen name="contact/[address]" options={{ title: 'Contact' }} />
        <Stack.Screen name="group/new" options={{ title: 'New group' }} />
        <Stack.Screen name="group/[address]/index" options={{ title: 'Group' }} />
        <Stack.Screen name="group/[address]/deposit" options={{ title: 'Add money', presentation: 'modal' }} />
        <Stack.Screen name="group/[address]/expense" options={{ title: 'Add expense', presentation: 'modal' }} />
        <Stack.Screen name="group/[address]/settle" options={{ title: 'Settle up', presentation: 'modal' }} />
        <Stack.Screen name="group/[address]/members" options={{ title: 'Members' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider><AppearanceProvider><MotionProvider>
      <WalletProvider>
        <ContactsProvider>
          <ToastProvider>
            <GroupsProvider>
              <ActivityProvider>
                <RootStack />
              </ActivityProvider>
            </GroupsProvider>
          </ToastProvider>
        </ContactsProvider>
      </WalletProvider>
    </MotionProvider></AppearanceProvider></SafeAreaProvider>
  );
}
