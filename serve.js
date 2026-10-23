'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = __dirname;
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.argv[2] || process.env.PORT || 8000);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function send(res, status, body, method) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    send(res, 405, 'Method Not Allowed', method);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    send(res, 400, 'Bad Request', method);
    return;
  }

  if (pathname.includes('\0')) {
    send(res, 400, 'Bad Request', method);
    return;
  }

  let filePath = path.resolve(root, '.' + pathname);
  if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    send(res, 403, 'Forbidden', method);
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not Found', method);
      return;
    }

    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) send(res, 500, 'Internal Server Error', method);
      else res.destroy();
    });
    stream.pipe(res);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`MathLab tersedia di:`);
  console.log(`  http://localhost:${port}/`);

  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`  http://${entry.address}:${port}/  (${entry.interface || 'jaringan'})`);
      }
    }
  }

  console.log('Tekan Ctrl+C untuk berhenti.');
});
