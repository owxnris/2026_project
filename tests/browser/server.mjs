// 브라우저 시험용 정적 서버: 프로젝트 폴더를 그대로, /__test/는 이 폴더(tests/browser)를 보여 준다. 포트 5599
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const TEST = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(TEST, '../..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = u.startsWith('/__test/') ? path.join(TEST, u.slice(8)) : path.join(ROOT, u === '/' ? 'index.html' : u);
  if (u.startsWith('/__test/') && !fs.existsSync(file)) file = path.join(ROOT, u.slice(8));
  fs.readFile(file, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(d);
  });
}).listen(5599, () => console.log('listening'));
