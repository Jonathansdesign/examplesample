import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.py':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json'};
const server = http.createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // A nested prefix tests the same relative URLs used by a GitHub project site.
    if (pathname.startsWith('/examplesample/')) pathname = pathname.slice('/examplesample'.length);
    const target = path.resolve(root, '.' + pathname);
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const info = await stat(target);
    const file = info.isDirectory() ? path.join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`examplesample: http://127.0.0.1:${port}/examplesample/`));
