import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
for (const entry of await readdir(path.join(root, 'web'))) await cp(path.join(root, 'web', entry), path.join(dist, entry), { recursive: true });
const hash = createHash('sha256');
for (const entry of (await readdir(path.join(root, 'web'))).sort()) hash.update(await readFile(path.join(root, 'web', entry)));
const swPath = path.join(dist, 'sw.js');
await writeFile(swPath, (await readFile(swPath, 'utf8')).replace('chagok-shell-v1', `chagok-shell-${hash.digest('hex').slice(0, 12)}`));
await writeFile(path.join(dist, '.nojekyll'), '');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
for (const file of ['app.js', 'core.js', 'storage.js', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg']) {
  if (!(await readFile(path.join(dist, file))).length) throw new Error(`빈 배포 파일: ${file}`);
}
if (!html.includes('lang="ko"')) throw new Error('한국어 문서 설정이 없습니다.');
console.log(`웹 배포 파일 준비 완료: ${dist}`);
