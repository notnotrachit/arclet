import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAddress, isAddress, type Address } from "viem";
import { parsePaymentUri } from "@/lib/payments";
import { requestScannedAddress } from "@/lib/scanBus";
import { ContactChips } from "./ContactChips";
import { colors, radius, spacing } from "./theme";

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
  const [text, setText] = useState("");
  const parsed = isAddress(text.trim())
    ? getAddress(text.trim())
    : (parsePaymentUri(text)?.to ?? null);

  const add = () => {
    if (!parsed) return;
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
          style={styles.input}
          onSubmitEditing={add}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan address QR"
          style={styles.icon}
          onPress={() => {
            requestScannedAddress(onAdd);
            router.push("/scan");
          }}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add address"
          style={[
            styles.icon,
            { backgroundColor: parsed ? colors.accent : colors.surfaceRaised },
          ]}
          disabled={!parsed}
          onPress={add}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ContactChips onPick={(a) => onAdd(a)} exclude={exclude} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
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
