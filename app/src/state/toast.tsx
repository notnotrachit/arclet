import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/ui/theme';

type Tone = 'success' | 'info' | 'error';
interface Toast {
  title: string;
  body?: string;
  tone: Tone;
  onPress?: () => void;
}

const ToastContext = createContext<(t: Toast) => void>(() => {});

/** In-app banner; works even if the user declined system notifications. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
  }, [anim]);

  const show = useCallback(
    (t: Toast) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, 4500);
    },
    [anim, hide],
  );

  const tint = toast?.tone === 'success' ? colors.positive : toast?.tone === 'error' ? colors.negative : colors.accent;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            },
          ]}>
          <Pressable
            accessibilityRole="alert"
            onPress={() => {
              toast.onPress?.();
              hide();
            }}
            style={[styles.toast, { borderLeftColor: tint }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{toast.title}</Text>
              {toast.body ? <Text style={styles.body}>{toast.body}</Text> : null}
            </View>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000 },
  toast: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 },
  body: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
});
