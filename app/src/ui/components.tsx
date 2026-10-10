import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { Atmosphere } from './Atmosphere';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from './theme';
import { useToast } from '@/state/toast';
import { Reveal, Touch } from './motion';

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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <Atmosphere />
      <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
              ) : undefined
            }>
            <Reveal>{children}</Reveal>
          </ScrollView>
        ) : (
          <Reveal style={[styles.content, { flex: 1 }]}>{children}</Reveal>
        )}
        {footer ? <Reveal delay={90} style={styles.footer}>{footer}</Reveal> : null}
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
  loadingTitle = 'Please wait…',
}: {
  title: string;
  loadingTitle?: string;
  onPress: () => void | Promise<unknown>;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [pending, setPending] = useState(false);
  const pressing = useRef(false);
  const toast = useToast();
  const press = async () => {
    if (pressing.current) return;
    pressing.current = true;
    try {
      const result = onPress();
      if (result && typeof result.then === 'function') { setPending(true); await result; }
    } catch (error) {
      toast({ title: 'Couldn’t complete that action', body: error instanceof Error ? error.message : 'Please try again.', tone: 'error' });
    } finally { pressing.current = false; setPending(false); }
  };
  const busy = !!loading || pending;
  const bg =
    variant === 'primary'
      ? colors.button
      : variant === 'secondary'
        ? colors.surfaceRaised
        : variant === 'danger'
          ? colors.dangerSoft
          : 'transparent';
  const fg = variant === 'primary' ? colors.onAccent : variant === 'danger' ? colors.negative : colors.text;
  const inactive = disabled || busy;
  return (
    <Touch
      accessibilityRole="button"
      accessibilityLabel={busy ? loadingTitle : title}
      accessibilityState={{ disabled: !!inactive, busy }}
      aria-disabled={!!inactive}
      aria-busy={busy}
      onPress={press}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { paddingHorizontal: spacing.sm },
        style,
      ]}>
      {busy ? (
        <><ActivityIndicator color={fg} /><Text style={[styles.buttonText, { color: fg }]}>{loadingTitle}</Text></>
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Touch>
  );
}

/** Round icon button used for the home quick actions. */
export function ActionButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Touch accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      {({ pressed }) => (
        <>
          <View style={[styles.actionIcon, pressed && { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={icon} size={23} color={colors.accent} />
          </View>
          <Text style={styles.actionLabel}>{label}</Text>
        </>
      )}
    </Touch>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemeStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.label, focused && { color: colors.accent }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        {...props}
        selectionColor={colors.accent}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[styles.input, focused && { borderColor: colors.accent, backgroundColor: colors.surfaceRaised }, error && { borderColor: colors.negative }, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: colors.negative }]}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.amountWrap}>
      <Text style={styles.amountCurrency}>$</Text>
      <TextInput
        accessibilityLabel="Amount in USDC"
        value={value}
        onChangeText={(t) => { const cleaned = t.replace(/,/g, '.').replace(/[^0-9.]/g, ''); const [whole, ...decimal] = cleaned.split('.'); onChange(decimal.length ? `${whole}.${decimal.join('').slice(0, 6)}` : whole); }}
        keyboardType="decimal-pad"
        selectionColor={colors.accent}
        maxLength={16}
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

const AVATAR_COLORS = ['#CDDEF6', '#D8D9F3', '#F5DDC9', '#E1D8ED', '#F2E5C6', '#CCE7E3', '#F0D9E2'];

export function Avatar({ address, name, size = 40 }: { address: Address | string; name?: string; size?: number }) {
  const { colors } = useTheme();
  const idx = (parseInt(address.slice(2, 8), 16) || 0) % AVATAR_COLORS.length;
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
      <Text style={{ color: colors.avatarInk, fontWeight: '800', fontSize: size * 0.4 }}>{initials}</Text>
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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
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
      <View style={{ alignItems: 'flex-end', marginLeft: spacing.sm, maxWidth: '42%', flexShrink: 1 }}>
        {typeof right === 'string' ? <Text style={styles.rowTitle}>{right}</Text> : right}
        {rightSub ? <Text style={styles.rowSubtitle}>{rightSub}</Text> : null}
        {!right && onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textFaint} /> : null}
      </View>
    </View>
  );
  return onPress || onLongPress ? (
    <Touch
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </Touch>
  ) : (
    content
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.accent} /></View>
      <Text style={[type.heading, { marginTop: spacing.sm }]}>{title}</Text>
      {body ? <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
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
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => (
        <Touch
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          aria-selected={o.value === value}
          accessibilityLabel={o.label}
          onPress={() => onChange(o.value)}
          style={[styles.segment, o.value === value && styles.segmentActive]}>
          <Text style={[styles.segmentText, o.value === value && { color: colors.onAccent }]}>{o.label}</Text>
        </Touch>
      ))}
    </View>
  );
}

export function Pill({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'accent' | 'positive' | 'negative' }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const fg =
    tone === 'accent' ? colors.accent : tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.textMuted;
  return (
    <View style={[styles.pill, { borderColor: `${fg}40`, backgroundColor: `${fg}10` }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'error'; children: ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  const c = tone === 'warning' ? colors.warning : tone === 'error' ? colors.negative : colors.accent;
  return (
    <Reveal><View accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'} style={[styles.banner, { borderColor: `${c}45`, backgroundColor: `${c}09` }]}>
      <Ionicons name={tone === 'info' ? 'information-circle' : 'warning'} size={18} color={c} />
      <Text style={[type.muted, { flex: 1, marginLeft: spacing.sm }]}>{children}</Text>
    </View></Reveal>
  );
}

export function PageIntro({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  const { colors, type } = useTheme();
  return <View style={{ marginBottom: spacing.lg }}>{eyebrow ? <Text style={{ ...type.small, color: colors.accent, letterSpacing: 2, fontWeight: '600', marginBottom: spacing.sm }}><Text style={{ color: colors.gold }}>{'{ '}</Text>{eyebrow.toUpperCase()}<Text style={{ color: colors.gold }}>{' }'}</Text></Text> : null}<Text style={type.title}>{title}</Text>{body ? <Text style={[type.muted, { marginTop: spacing.sm }]}>{body}</Text> : null}</View>;
}

export function SuccessMark() {
  const { colors } = useTheme();
  return <Reveal><View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={48} color={colors.accent} /></View></Reveal>;
}

const createStyles = ({ colors, type }: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  footer: { backgroundColor: colors.footer, padding: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  buttonText: { flexShrink: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  action: { alignItems: 'center', flex: 1, minWidth: 0, paddingVertical: spacing.sm, borderRadius: radius.md },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontWeight: '600' },
  card: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.035, shadowRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...type.heading, flexShrink: 1, marginRight: spacing.sm },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 16,
  },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.lg },
  amountCurrency: { color: colors.textMuted, fontSize: 36, fontWeight: '400', marginRight: 4 },
  amountInput: { fontFamily: type.hero.fontFamily, letterSpacing: -1.5, color: colors.text, fontSize: 48, flexShrink: 1, maxWidth: '72%', fontWeight: '400', minWidth: 60, textAlign: 'center', padding: 0 },
  amountUnit: { color: colors.textMuted, fontSize: 16, fontWeight: '700', marginLeft: spacing.sm, alignSelf: 'flex-end', marginBottom: 12 },
  row: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, marginBottom: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginVertical: spacing.sm },
  segment: { flex: 1, paddingVertical: 12, minHeight: 44, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.button },
  segmentText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
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
