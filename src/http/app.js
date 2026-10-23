// HTTP application server built strictly using node:http.
// Provides standardized error formatting, static file serving with directory
// traversal protection, JSON request body parsing, and route dispatching.

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { Router } from './router.js';

const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, code, message) {
  // Uniform error shape across the entire application; stack traces never leak
  sendJson(res, statusCode, {
    error: {
      code,
      message,
    },
  });
}

async function parseJsonBody(req) {
  const contentType = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return undefined;
  }

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new DomainError('INVALID_JSON', 'Request body must contain valid JSON');
  }
}

async function serveStaticFile(res, reqPath, publicDir, method) {
  let decoded;
  try {
    decoded = decodeURIComponent(reqPath);
  } catch {
    sendError(res, 400, 'INVALID_PATH', 'The request path is invalid');
    return;
  }

  const root = resolve(publicDir);
  const targetRelative = decoded === '/' ? '/index.html' : decoded;
  const targetPath = resolve(root, `.${targetRelative}`);

  // Prevent path traversal
  const relPath = relative(root, targetPath);
  if (isAbsolute(relPath) || relPath === '..' || relPath.startsWith(`..${sep}`)) {
    sendError(res, 404, 'NOT_FOUND', 'File not found');
    return;
  }

  try {
    const [realRoot, realTarget] = await Promise.all([
      realpath(root),
      realpath(targetPath),
    ]);

    const actualRel = relative(realRoot, realTarget);
    if (isAbsolute(actualRel) || actualRel === '..' || actualRel.startsWith(`..${sep}`)) {
      sendError(res, 404, 'NOT_FOUND', 'File not found');
      return;
    }

    const fileStat = await stat(realTarget);
    if (!fileStat.isFile()) {
      sendError(res, 404, 'NOT_FOUND', 'File not found');
      return;
    }

    const ext = extname(realTarget).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'content-length': fileStat.size,
      'content-type': contentType,
    });

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const readStream = createReadStream(realTarget);
    readStream.on('error', () => {
      if (res.headersSent) {
        res.destroy();
      } else {
        sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
      }
    });
    readStream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      sendError(res, 404, 'NOT_FOUND', 'File not found');
      return;
    }
    throw err;
  }
}

export function createAppServer({
  router = new Router(),
  publicDirectory = DEFAULT_PUBLIC_DIR,
} = {}) {
  // Ensure default health check endpoint is registered
  if (!router.match('GET', '/health')) {
    router.get('/health', () => ({ status: 200, body: { status: 'ok' } }));
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = router.match(req.method ?? 'GET', url.pathname);
      const body = await parseJsonBody(req);

      if (route) {
        const result = await route.handler({ req, params: route.params, body });
        sendJson(res, result?.status ?? 200, result?.body ?? result ?? null);
      } else if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        sendError(res, 404, 'NOT_FOUND', 'API route not found');
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStaticFile(res, url.pathname, publicDirectory, req.method);
      } else {
        sendError(res, 404, 'NOT_FOUND', 'Route not found');
      }
    } catch (err) {
      if (res.headersSent) {
        res.destroy(err);
        return;
      }
      if (err instanceof DomainError) {
        sendError(res, 400, err.code, err.message);
        return;
      }
      // Never expose internal error message or stack trace to client
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  });
}
