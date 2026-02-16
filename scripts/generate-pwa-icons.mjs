import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.resolve(__dirname, '../assets/logo.png');
const OUT  = path.resolve(__dirname, '../src/ui/public');

const configs = [
  // purpose: 'any' — logo com padding confortável
  { size: 512, logoSize: 400, name: 'pwa-512x512.png' },
  { size: 192, logoSize: 150, name: 'pwa-192x192.png' },
  // purpose: 'maskable' — logo menor para respeitar safe zone (80% central)
  { size: 512, logoSize: 340, name: 'pwa-maskable-512x512.png' },
  { size: 192, logoSize: 128, name: 'pwa-maskable-192x192.png' },
];

for (const { size, logoSize, name } of configs) {
  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: '#000000' })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: '#000000' }
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(OUT, name));

  console.log(`✓ ${name}`);
}

console.log('\nTodos os ícones PWA gerados com sucesso!');
