// Expo config plugin: lets Android's tag dispatcher open Arclet when the phone reads an
// arclet://pay NDEF record (e.g. tapping a receiver's phone), instead of the system tag viewer.
// Expo's built-in `intentFilters` always prefixes actions with "android.intent.action.", which
// breaks android.nfc.action.NDEF_DISCOVERED, so we add the filter directly.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const ACTION = 'android.nfc.action.NDEF_DISCOVERED';

module.exports = function withNfcLaunch(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = activity['intent-filter'] ?? [];
    const exists = activity['intent-filter'].some((f) =>
      (f.action ?? []).some((a) => a.$['android:name'] === ACTION),
    );
    if (!exists) {
      activity['intent-filter'].push({
        action: [{ $: { 'android:name': ACTION } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:scheme': 'arclet', 'android:host': 'pay' } }],
      });
    }
    return cfg;
  });
};
