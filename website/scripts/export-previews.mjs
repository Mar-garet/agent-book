import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const website = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(website, '../docs/assets');
await mkdir(destination, { recursive: true });
for (const [source, target] of [
  ['preview-1440.png', 'reader-desktop.webp'],
  ['reader-light.png', 'reader-chapter.webp'],
  ['preview-375.png', 'reader-mobile.webp'],
  ['home-system-topics.png', 'reader-system-topics.webp'],
]) {
  await sharp(resolve(website, 'test-results', source))
    .webp({ quality: 90 }).toFile(resolve(destination, target));
  console.log(`Exported docs/assets/${target}`);
}
