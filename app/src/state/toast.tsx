import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touch, useReducedMotion } from '@/ui/motion';
import { radius, spacing, useTheme, useThemeStyles, type Theme } from '@/ui/theme';

type Tone = 'success' | 'info' | 'error';
interface Toast { title: string; body?: string; tone: Tone; onPress?: () => void }
const ToastContext = createContext<(t: Toast) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [toast, setToast] = useState<Toast | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const id = generation.current;
    Animated.timing(anim, { toValue: 0, duration: reduced ? 0 : 180, useNativeDriver: true }).start(({ finished }) => { if (finished && id === generation.current) setToast(null); });
  }, [anim, reduced]);
  const show = useCallback((t: Toast) => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    anim.stopAnimation();
    setToast(t);
    Animated.timing(anim, { toValue: 1, duration: reduced ? 0 : 240, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, t.body ? 6500 : 4500);
  }, [anim, hide, reduced]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); anim.stopAnimation(); }, [anim]);
  const tint = toast?.tone === 'success' ? colors.positive : toast?.tone === 'error' ? colors.negative : colors.accent;
  return <ToastContext.Provider value={show}>{children}{toast ? <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + spacing.sm, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
    <View style={[styles.toast, { borderColor: `${tint}66` }]} accessibilityLiveRegion="polite">
      <Ionicons name={toast.tone === 'success' ? 'checkmark-circle' : toast.tone === 'error' ? 'alert-circle' : 'information-circle'} size={24} color={tint} />
      <Touch accessibilityRole={toast.onPress ? 'button' : undefined} accessibilityLabel={toast.title} onPress={() => { toast.onPress?.(); hide(); }} style={{ flex: 1, borderRadius: radius.sm, paddingVertical: 8 }}><Text style={styles.title}>{toast.title}</Text>{toast.body ? <Text style={styles.body}>{toast.body}</Text> : null}</Touch>
      <Touch accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={hide} style={styles.close}><Ionicons name="close" size={18} color={colors.textMuted} /></Touch>
    </View>
  </Animated.View> : null}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
const createStyles = ({ colors }: Theme) => StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000, maxWidth: 608, alignSelf: 'center', width: 'auto' },
  toast: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  close: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontWeight: '600', fontSize: 15 },
  body: { color: colors.textMuted, marginTop: 4, fontSize: 13, lineHeight: 19 },
});
