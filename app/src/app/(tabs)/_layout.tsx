import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '@/ui/theme';
import { selectionFeedback } from '@/ui/motion';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => selectionFeedback() }}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 22, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8), height: 64 + Math.max(insets.bottom, 8) },
        tabBarItemStyle: { paddingVertical: 2, borderRadius: 16, marginHorizontal: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarActiveBackgroundColor: colors.accentSoft,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "wallet" : "wallet-outline"} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "people-circle" : "people-circle-outline"} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "receipt" : "receipt-outline"} size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
