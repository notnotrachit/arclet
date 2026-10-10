import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { parsePaymentUri } from '@/lib/payments';
import { openPayRequest } from '@/lib/routing';
import { cancelScannedAddress, hasPendingAddressRequest, resolveScannedAddress } from '@/lib/scanBus';
import { Button, Screen } from '@/ui/components';
import { colors, radius, spacing, type } from '@/ui/theme';

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string>();
  const handled = useRef(false);
  const [addressMode] = useState(hasPendingAddressRequest);

  useEffect(() => () => {
    if (!handled.current && addressMode) cancelScannedAddress();
  }, [addressMode]);

  if (!permission) return <Screen scroll={false}>{null}</Screen>;

  if (!permission.granted) {
    return (
      <Screen scroll={false} footer={<Button title="Allow camera" onPress={requestPermission} />}>
        <View style={styles.center}>
          <Text style={type.title}>Camera access</Text>
          <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.sm }]}>
            Arclet needs the camera to scan payment QR codes. Nothing is recorded.
          </Text>
        </View>
      </Screen>
    );
  }

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    const req = parsePaymentUri(data);
    if (!req) {
      setError('That QR code isn’t a payment request or address.');
      return;
    }
    handled.current = true;
    Haptics.selectionAsync().catch(() => {});
    if (addressMode) {
      resolveScannedAddress(req.to);
      router.back();
    } else {
      openPayRequest(req, { replace: true });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Text style={styles.hint}>{error ?? (addressMode ? 'Scan an Arclet QR or address' : 'Point at an Arclet or wallet QR code')}</Text>
        <Button title="Close" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  frame: { width: 250, height: 250, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.accent },
  hint: {
    color: colors.text,
    marginTop: spacing.lg,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
