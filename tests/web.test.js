import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../web/', import.meta.url);

test('오프라인 설치 목록의 모든 파일이 배포 원본에 존재한다', async () => {
  const sw = await readFile(new URL('sw.js', root), 'utf8'); const list = sw.match(/const FILES = (\[[^;]+\]);/)[1]; const files = vm.runInNewContext(list);
  for (const name of files) { if (name !== './') assert.ok((await readFile(new URL(name, root))).length > 0, name); }
});
test('웹 원본은 외부 스크립트·폰트·네트워크 API를 참조하지 않는다', async () => {
  for (const file of await readdir(root)) {
    const source = await readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /(?:src|href)=["']https?:\/\//, file);
    assert.doesNotMatch(source, /fetch\(['"]https?:\/\//, file);
    assert.doesNotMatch(source, /@import\s+url|fonts\.googleapis|cdn\./, file);
  }
});
test('여섯 메뉴와 스크립트 진입점이 한국어 문서에 포함된다', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8'); assert.match(html, /lang="ko"/);
  for (const route of ['dashboard', 'entry', 'history', 'analytics', 'accounts', 'fixed']) assert.ok(html.includes(`data-route="${route}"`), route);
  assert.match(html, /src="\.\/app.js" type="module"/);
});
