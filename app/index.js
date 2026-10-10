// Polyfills must load before anything that touches crypto (viem key generation).
import './src/polyfills';

// Register the app entry through Expo Router (keep last).
import 'expo-router/entry';
