import { Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppearance, type AppearancePreference } from '@/state/appearance';
import { useToast } from '@/state/toast';
import { Touch } from './motion';
import { radius, spacing, useTheme } from './theme';

const options = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
] as const;

export function AppearancePicker() {
  const { colors, type, mode } = useTheme();
  const { preference, setPreference } = useAppearance();
  const toast = useToast();
  const choose = (value: AppearancePreference) => {
    setPreference(value).catch(() => toast({ title: 'Couldn’t save appearance', body: 'Please try again.', tone: 'error' }));
  };
  return <View style={{ marginBottom: spacing.lg }}>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ flexDirection: 'row', gap: spacing.sm }}>
      {options.map((option) => {
        const selected = preference === option.value;
        return <Touch key={option.value} accessibilityRole="radio" accessibilityLabel={`${option.label} mode`} aria-checked={selected} accessibilityState={{ checked: selected }} onPress={() => choose(option.value)} style={{ flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.surface, alignItems: 'center', gap: 8 }}>
          <View style={{ width: '100%', height: 52, borderRadius: 9, borderWidth: 1, borderColor: option.value === 'dark' ? '#40506A' : '#C9D9E8', backgroundColor: option.value === 'dark' ? '#152238' : '#E7F3FC', overflow: 'hidden', padding: 9, gap: 5 }}>
            {option.value === 'system' ? <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%', backgroundColor: '#152238' }} /> : null}
            <View style={{ width: '50%', height: 4, borderRadius: 2, backgroundColor: option.value === 'dark' ? '#B3D9FC' : '#526480' }} />
            <View style={{ width: '80%', height: 18, borderRadius: 5, backgroundColor: option.value === 'dark' ? '#2B405D' : '#FFFFFF', opacity: 0.8 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name={option.icon} size={14} color={selected ? colors.accent : colors.textMuted} /><Text style={{ ...type.small, color: selected ? colors.accent : colors.textMuted, fontWeight: '600' }}>{option.label}</Text></View>
          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selected ? colors.accent : colors.textFaint} />
        </Touch>;
      })}
    </View>
    <Text accessibilityLiveRegion="polite" style={[type.small, { marginTop: spacing.sm }]}>{preference === 'system' ? `Following your device · ${mode === 'dark' ? 'Dark' : 'Light'} mode` : `${preference === 'dark' ? 'Dark' : 'Light'} mode is always on`}</Text>
  </View>;
}
