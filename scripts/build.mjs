import { cp, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
export async function buildSite() {
await mkdir(dist, { recursive: true });
const assets = ['index.html', 'styles.css', 'boot.js', 'sw.js', 'icon.svg', 'manifest.webmanifest'];
for (const entry of assets) await cp(path.join(root, 'web', entry), path.join(dist, entry));
// 이전 배포에서 생성한 모듈 파일은 단일 실행 파일로 대체한다.
for (const legacy of ['app.js', 'core.js', 'storage.js', 'compat.js']) {
  try { await unlink(path.join(dist, legacy)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// 모듈 로딩과 최신 문법에 대한 WebView 의존을 줄인다. 실행 중 외부 요청은 없다.
await build({ entryPoints: [path.join(root, 'web/app.js')], bundle: true, format: 'iife', target: ['es2017'], charset: 'utf8', outfile: path.join(dist, 'app.bundle.js'), legalComments: 'none' });
const hash = createHash('sha256');
for (const entry of [...assets, 'app.bundle.js'].sort()) hash.update(await readFile(path.join(dist, entry)));
const swPath = path.join(dist, 'sw.js');
await writeFile(swPath, (await readFile(swPath, 'utf8')).replace('chagok-shell-v1', `chagok-shell-${hash.digest('hex').slice(0, 12)}`));
await writeFile(path.join(dist, '.nojekyll'), '');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
for (const file of ['app.bundle.js', 'boot.js', 'styles.css', 'sw.js', 'manifest.webmanifest', 'icon.svg']) {
  if (!(await readFile(path.join(dist, file))).length) throw new Error(`빈 배포 파일: ${file}`);
}
if (!html.includes('lang="ko"')) throw new Error('한국어 문서 설정이 없습니다.');
console.log(`웹 배포 파일 준비 완료: ${dist}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSite();
