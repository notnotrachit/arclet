import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Address } from 'viem';
import { useContacts } from '@/state/contacts';
import { Avatar } from './components';
import { colors, radius, spacing } from './theme';

/** Horizontal quick-pick of saved contacts. Hidden when there are none. */
export function ContactChips({ onPick, exclude = [] }: { onPick: (a: Address, name: string) => void; exclude?: Address[] }) {
  const { list } = useContacts();
  const skip = new Set(exclude.map((a) => a.toLowerCase()));
  const shown = list.filter((c) => !skip.has(c.address.toLowerCase()));
  if (shown.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {shown.map((c) => (
        <Pressable
          key={c.address}
          accessibilityRole="button"
          accessibilityLabel={`Choose ${c.name}`}
          onPress={() => onPick(c.address, c.name)}
          style={({ pressed }) => [styles.chip, pressed && { borderColor: colors.accent }]}>
          <Avatar address={c.address} name={c.name} size={24} />
          <Text style={styles.text} numberOfLines={1}>
            {c.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: 180,
  },
  text: { color: colors.text, fontWeight: '600', fontSize: 14 },
});
