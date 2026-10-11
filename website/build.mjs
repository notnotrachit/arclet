import { access } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'styles.css',
  'arc-brand.css',
  'script.js',
  'assets/favicon.png',
  'assets/arclet-device-screen.png',
  'assets/arclet-mark.svg',
  'assets/arc-chain.svg',
];

for (const file of requiredFiles) {
  await access(new URL(file, import.meta.url));
}

console.log(`Arclet static site is ready (${requiredFiles.length} required files found).`);
