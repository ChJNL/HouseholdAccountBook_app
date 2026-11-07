import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildSite } from './build.mjs';
import { watch } from 'node:fs';
await buildSite();
const root = path.resolve(import.meta.dirname, '..', 'dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    let file = path.resolve(root, `.${decoded}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('파일을 찾을 수 없습니다.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`로컬 미리보기: http://127.0.0.1:${port}`));
let debounce;
let building = Promise.resolve();
const watcher = watch(path.resolve(import.meta.dirname, '..', 'web'), { recursive: true }, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { building = building.then(buildSite).catch(error => console.error(`빌드 실패: ${error.message}`)); }, 200);
});
server.on('close', () => watcher.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
