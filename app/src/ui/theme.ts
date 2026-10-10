import { createContext, useContext } from 'react';
import { Platform } from 'react-native';

// Arc-inspired sky blue, warm ivory and deep ink.
const lightColors = {
  bg: '#EEF5FB',
  surface: '#FFFFFF',
  surfaceRaised: '#EDF3FA',
  border: '#D8E2ED',
  text: '#203154',
  textMuted: '#526480',
  textFaint: '#596C85',
  accent: '#273A63',
  accentSoft: '#E3EFFA',
  positive: '#237154',
  negative: '#B54148',
  warning: '#92601D',
  onAccent: '#FFFFFF',
  button: '#121A2D',
  dangerSoft: '#FCECEE',
  gold: '#C48A30',
  footer: '#FFFFFFF2', card: '#FFFFFFF0', shadow: '#26466C',
  orbital: '#FFFFFFCC', avatarInk: '#203154',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
const displayFont = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-light', web: '"Avenir Next", "Trebuchet MS", sans-serif', default: 'sans-serif' });
const typography = (colors: typeof lightColors) => ({
  hero: { fontFamily: displayFont, fontSize: 48, fontWeight: '400' as const, color: colors.text, letterSpacing: -2 },
  title: { fontFamily: displayFont, fontSize: 28, fontWeight: '400' as const, color: colors.text, letterSpacing: -0.8 },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 14, lineHeight: 21, color: colors.textMuted },
  small: { fontSize: 12, lineHeight: 18, color: colors.textFaint },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, color: colors.textMuted },
});

const darkColors: typeof lightColors = {
  bg: '#0C1424', surface: '#162237', surfaceRaised: '#1D2B43', border: '#31425B',
  text: '#EDF4FF', textMuted: '#B1C1D8', textFaint: '#98ADC9',
  accent: '#B3D9FC', accentSoft: '#233B56', positive: '#86DEB6', negative: '#FFA0A6',
  warning: '#EAC18A', onAccent: '#112039', button: '#D8EAFB', dangerSoft: '#3D2632',
  gold: '#E7BA77', footer: '#101C2DF5', card: '#162237F5', shadow: '#000000',
  orbital: '#A7CCEF30', avatarInk: '#203154',
};
export const themes = {
  light: { colors: lightColors, type: typography(lightColors), mode: 'light' as const },
  dark: { colors: darkColors, type: typography(darkColors), mode: 'dark' as const },
};
export type Theme = (typeof themes)['light' | 'dark'];
export const ThemeContext = createContext<Theme>(themes.light);
export const useTheme = () => useContext(ThemeContext);
const styleCache = new WeakMap<(theme: Theme) => object, Map<Theme, object>>();
/** Cache each style sheet once per palette; no screen or wallet remount on theme changes. */
export function useThemeStyles<T extends object>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  let palettes = styleCache.get(factory);
  if (!palettes) { palettes = new Map(); styleCache.set(factory, palettes); }
  let styles = palettes.get(theme);
  if (!styles) { styles = factory(theme); palettes.set(theme, styles); }
  return styles as T;
}
