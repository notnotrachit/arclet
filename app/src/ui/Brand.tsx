import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Atmosphere } from './Atmosphere';
import { spacing, useTheme, useThemeStyles, type Theme } from './theme';

const mark = require('../../assets/brand/arclet-mark.png');

/** The same master symbol is used on the launcher, splash and in-app lockup. */
export function Brand({ size = 38, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const { colors } = useTheme();
  return <View accessible accessibilityRole="image" accessibilityLabel="Arclet" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Image source={mark} resizeMode="contain" style={{ width: size, height: size }} />
    {wordmark ? <Text style={{ color: colors.text, fontSize: size * 0.74, fontWeight: '600', letterSpacing: -1.3 }}>arclet</Text> : null}
  </View>;
}

export function BrandLoading() {
  const styles = useThemeStyles(createStyles);
  const { colors, type } = useTheme();
  return <View style={styles.loading}>
    <Atmosphere />
    <View style={styles.identity}><Brand size={104} wordmark={false} /><Text style={[type.title, { fontSize: 38, letterSpacing: -1.8, marginTop: 12 }]}>arclet</Text><Text style={[type.small, { letterSpacing: 2, marginTop: 8 }]}>MADE FOR SHARING</Text></View>
    <ActivityIndicator accessibilityLabel="Loading Arclet" color={colors.accent} style={{ marginTop: spacing.xl }} />
  </View>;
}
const createStyles = ({ colors }: Theme) => StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  identity: { alignItems: 'center' },
});
