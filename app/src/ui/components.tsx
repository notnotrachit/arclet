import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Address } from 'viem';
import { colors, radius, spacing, type } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['bottom'],
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'bottom')[];
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.surfaceRaised
        : variant === 'danger'
          ? '#3A1C22'
          : 'transparent';
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.negative : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { paddingHorizontal: spacing.sm },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Round icon button used for the home quick actions. */
export function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      {({ pressed }) => (
        <>
          <View style={[styles.actionIcon, pressed && { backgroundColor: colors.accent }]}>
            <Ionicons name={icon} size={24} color={colors.text} />
          </View>
          <Text style={styles.actionLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]}
      />
      {error ? <Text style={[styles.hint, { color: colors.negative }]}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Big centered amount entry. */
export function AmountInput({
  value,
  onChange,
  editable = true,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.amountWrap}>
      <Text style={styles.amountCurrency}>$</Text>
      <TextInput
        accessibilityLabel="Amount in USDC"
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        editable={editable}
        autoFocus={autoFocus}
        style={styles.amountInput}
      />
      <Text style={styles.amountUnit}>USDC</Text>
    </View>
  );
}

const AVATAR_COLORS = ['#4F8CFF', '#3DDC97', '#FF8A5B', '#B78CFF', '#FFC857', '#4FD1E8', '#FF6B9A'];

export function Avatar({ address, name, size = 40 }: { address: Address | string; name?: string; size?: number }) {
  const idx = parseInt(address.slice(2, 8), 16) % AVATAR_COLORS.length;
  const initials = name && !name.startsWith('0x') ? name.slice(0, 1).toUpperCase() : address.slice(2, 4).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATAR_COLORS[idx],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: '#0B0F17', fontWeight: '800', fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

export function ListRow({
  left,
  title,
  subtitle,
  right,
  rightSub,
  onPress,
  onLongPress,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  rightSub?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      {left}
      <View style={{ flex: 1, marginLeft: left ? spacing.md : 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm }}>
        {typeof right === 'string' ? <Text style={styles.rowTitle}>{right}</Text> : right}
        {rightSub ? <Text style={styles.rowSubtitle}>{rightSub}</Text> : null}
      </View>
    </View>
  );
  return onPress || onLongPress ? (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Text style={[type.heading, { marginTop: spacing.sm }]}>{title}</Text>
      {body ? <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.xs }]}>{body}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}>
          <Text style={[styles.segmentText, o.value === value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Pill({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'accent' | 'positive' | 'negative' }) {
  const fg =
    tone === 'accent' ? colors.accent : tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: fg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const c = tone === 'warning' ? colors.warning : tone === 'error' ? colors.negative : colors.accent;
  return (
    <View style={[styles.banner, { borderColor: c }]}>
      <Ionicons name={tone === 'info' ? 'information-circle' : 'warning'} size={18} color={c} />
      <Text style={[type.muted, { flex: 1, marginLeft: spacing.sm }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  action: { alignItems: 'center', width: 72 },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...type.heading },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  amountCurrency: { color: colors.textMuted, fontSize: 36, fontWeight: '700', marginRight: 4 },
  amountInput: { color: colors.text, fontSize: 52, fontWeight: '800', minWidth: 60, textAlign: 'center', padding: 0 },
  amountUnit: { color: colors.textMuted, fontSize: 16, fontWeight: '700', marginLeft: spacing.sm, alignSelf: 'flex-end', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginVertical: spacing.sm },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surfaceRaised },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
});
