import { Touch } from '@/ui/motion';
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAddress, isAddress, type Address } from "viem";
import { parsePaymentUri } from "@/lib/payments";
import { requestScannedAddress } from "@/lib/scanBus";
import { ContactChips } from "./ContactChips";
import { radius, spacing, useTheme, useThemeStyles, type Theme } from './theme';

/** Paste / type / scan an address, or tap a saved contact. Calls onAdd with a checksummed address. */
export function AddressPicker({
  onAdd,
  placeholder = "Paste 0x address or scan",
  exclude = [],
}: {
  onAdd: (a: Address) => void;
  placeholder?: string;
  /** Contacts to hide from the quick-pick (e.g. people already added). */
  exclude?: Address[];
}) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const parsed = isAddress(text.trim())
    ? getAddress(text.trim())
    : (parsePaymentUri(text)?.to ?? null);

  const excluded = parsed && exclude.some((a) => a.toLowerCase() === parsed.toLowerCase());
  const add = () => {
    if (!parsed || excluded) return;
    onAdd(parsed);
    setText("");
  };

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          accessibilityLabel="Member address"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && { borderColor: colors.accent }]}
          onSubmitEditing={add}
        />
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Scan address QR"
          style={styles.icon}
          onPress={() => {
            requestScannedAddress(onAdd);
            router.push("/scan");
          }}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.text} />
        </Touch>
        <Touch
          accessibilityRole="button"
          accessibilityLabel="Add address"
          style={[
            styles.icon,
            { backgroundColor: parsed ? colors.accent : colors.surfaceRaised },
          ]}
          disabled={!parsed || !!excluded}
          accessibilityState={{ disabled: !parsed || !!excluded }}
          onPress={add}
        >
          <Ionicons name="add" size={22} color={parsed ? colors.onAccent : colors.textMuted} />
        </Touch>
      </View>
      {text.trim() ? <Text accessibilityLiveRegion="polite" style={{ color: excluded ? colors.warning : parsed ? colors.accent : colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 12 }}>{excluded ? 'This person is already included.' : parsed ? 'Address ready. Tap + to add.' : 'Enter a full wallet address or scan a QR code.'}</Text> : null}
      <ContactChips onPick={(a) => onAdd(a)} exclude={exclude} />
    </View>
  );
}

const createStyles = ({ colors }: Theme) => StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
});
