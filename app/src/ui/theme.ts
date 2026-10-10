export const colors = {
  bg: '#0B0F17',
  surface: '#131A26',
  surfaceRaised: '#1B2433',
  border: '#263247',
  text: '#F2F5FA',
  textMuted: '#97A3B8',
  textFaint: '#6B778C',
  accent: '#4F8CFF',
  accentSoft: '#1E3358',
  positive: '#3DDC97',
  negative: '#FF6B6B',
  warning: '#FFC857',
  onAccent: '#FFFFFF',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const type = {
  hero: { fontSize: 44, fontWeight: '800' as const, color: colors.text, letterSpacing: -1 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 14, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textFaint },
  mono: { fontFamily: 'monospace', fontSize: 13, color: colors.textMuted },
};
