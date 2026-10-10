import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme, useThemeStyles, type Theme } from './theme';

/** Scalable sky, cloud and warm-light layers; shared by native and web. */
export function Atmosphere({ panel = false }: { panel?: boolean }) {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const orbit = dark ? '#9AC3E8' : '#FFFFFF';
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 600 900" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}sky`} x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={dark ? (panel ? '#243D59' : '#142840') : panel ? '#BFDFF7' : '#D7ECFC'} />
            <Stop offset="0.48" stopColor={dark ? (panel ? '#1B2B42' : '#101D30') : panel ? '#E7F3FD' : '#EDF6FC'} />
            <Stop offset="1" stopColor={dark ? (panel ? '#342E36' : '#191D2A') : panel ? '#FBE8D6' : '#FFF7EE'} />
          </LinearGradient>
          <RadialGradient id={`${id}cloud`} cx="0.85" cy="0.2" rx="0.8" ry="0.65">
            <Stop offset="0" stopColor={dark ? '#406186' : '#FFFFFF'} stopOpacity={dark ? 0.22 : 0.78} />
            <Stop offset="1" stopColor={dark ? '#406186' : '#FFFFFF'} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}warm`} cx="0.1" cy="1" rx="0.9" ry="0.6">
            <Stop offset="0" stopColor={dark ? '#B78B69' : '#F8D8BC'} stopOpacity={dark ? 0.08 : 0.45} />
            <Stop offset="1" stopColor={dark ? '#B78B69' : '#F8D8BC'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="600" height="900" fill={`url(#${id}sky)`} />
        <Rect width="600" height="900" fill={`url(#${id}cloud)`} />
        <Rect width="600" height="900" fill={`url(#${id}warm)`} />
        <Path d="M -260 330 C 80 370 230 170 190 -90" stroke={orbit} strokeWidth={panel ? 2 : 1.3} fill="none" opacity={dark ? 0.16 : 0.8} />
        <Path d="M 340 1040 C 300 640 420 410 770 455" stroke={orbit} strokeWidth={panel ? 2 : 1.3} fill="none" opacity={dark ? 0.16 : 0.8} />
        <Path d="M -20 755 H 620 M -80 480 L 115 680 V 930" stroke={orbit} strokeWidth="1" fill="none" opacity={dark ? 0.12 : 0.6} />
        <Circle cx="176" cy="118" r="3" fill={orbit} opacity={dark ? 0.35 : 0.9} />
        <Circle cx="115" cy="785" r="3" fill={orbit} opacity={dark ? 0.35 : 0.9} />
        <Circle cx="513" cy="473" r="3" fill={orbit} opacity={dark ? 0.35 : 0.9} />
      </Svg>
    </View>
  );
}

export function GradientPanel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={[styles.panel, style]}>
      <Atmosphere panel />
      {children}
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  panel: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.orbital,
    borderRadius: 24,
    overflow: 'hidden',
  },
});
