import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './theme';
import * as Haptics from 'expo-haptics';

const MotionContext = createContext(true);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}

export const useReducedMotion = () => useContext(MotionContext);
export function selectionFeedback() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One tactile interaction shared by buttons, rows, chips and navigation. */
export function Touch({ children, style, onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, disabled, ...props }: PressableProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const spring = (toValue: number) => {
    scale.stopAnimation();
    if (reduced) scale.setValue(1);
    else Animated.spring(scale, { toValue, speed: 36, bounciness: 5, useNativeDriver: true }).start();
  };
  useEffect(() => () => scale.stopAnimation(), [scale]);
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={(event) => { selectionFeedback(); onPress?.(event); }}
      onPressIn={(event) => { setPressed(true); spring(0.97); onPressIn?.(event); }}
      onPressOut={(event) => { setPressed(false); spring(1); onPressOut?.(event); }}
      onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
      onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      style={[
        typeof style === 'function' ? style({ pressed, hovered }) : style,
        { transform: [{ scale }], opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        hovered && !disabled && { opacity: 0.92 },
        focused && { outlineColor: colors.accent, outlineWidth: 2, outlineOffset: 3 },
      ]}>
      {children}
    </AnimatedPressable>
  );
}

export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 350, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>{children}</Animated.View>;
}

/** Ambient feedback used only while scanning or waiting for a payment. */
export function Pulse({ children, active = true, style }: { children: ReactNode; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    progress.setValue(0);
    if (!active || reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 1100, isInteraction: false, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: 1100, isInteraction: false, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, reduced, progress]);
  return <Animated.View style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }), transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]}>{children}</Animated.View>;
}
