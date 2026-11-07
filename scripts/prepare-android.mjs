import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildSite } from './build.mjs';
await buildSite();
const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'android/app/src/main/assets');
await mkdir(destination, { recursive: true });
for (const entry of await readdir(path.join(root, 'dist'))) await cp(path.join(root, 'dist', entry), path.join(destination, entry), { recursive: true });
console.log(`Android 웹 파일 준비 완료: ${destination}`);
