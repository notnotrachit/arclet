import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { parsePaymentUri } from '@/lib/payments';
import { openPayRequest } from '@/lib/routing';
import { cancelScannedAddress, hasPendingAddressRequest, resolveScannedAddress } from '@/lib/scanBus';
import { Button, Empty, Screen } from '@/ui/components';
import { Pulse } from '@/ui/motion';
import { radius, spacing } from '@/ui/theme';

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
      <Screen scroll={false} footer={<><Button title={permission.canAskAgain ? 'Allow camera' : 'Open settings'} onPress={() => permission.canAskAgain || Platform.OS === 'web' ? requestPermission() : Linking.openSettings()} /><Button title="Go back" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.sm }} /></>}>
        <View style={styles.center}>
          <Empty icon="camera-outline" title="Scan. Check. Send." body={permission.canAskAgain ? 'Allow camera access to scan payment requests and addresses. Nothing is recorded.' : 'Camera access is disabled. Enable it in your device or browser settings, then return to scan.'} />
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
        <Pulse style={styles.frame}><View style={styles.scanLine} /></Pulse>
        <Text style={styles.hint}>{error ?? (addressMode ? 'Scan an Arclet QR or address' : 'Point at an Arclet or wallet QR code')}</Text>
        <Button title="Close" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  scanLine: { height: 2, width: '80%', backgroundColor: '#FFFFFF', alignSelf: 'center', marginTop: 124, opacity: 0.65 },
  frame: { width: 250, height: 250, borderRadius: radius.lg, borderWidth: 3, borderColor: '#FFFFFF' },
  hint: {
    color: '#FFFFFF',
    marginTop: spacing.lg,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textAlign: 'center',
  },
});
