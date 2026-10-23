import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../src/http/app.js';

describe('HTTP Application Server', () => {
  const app = createAppServer();
  let baseUrl;

  before(async () => {
    await new Promise((resolve, reject) => {
      app.once('error', reject);
      app.listen(0, '127.0.0.1', resolve);
    });
    const { port } = app.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      app.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('answers a real HTTP request to GET /health with {"status":"ok"}', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');

    const body = await res.json();
    assert.deepEqual(body, { status: 'ok' });
  });

  it('returns uniform JSON error format for unknown /api routes with 404', async () => {
    const res = await fetch(`${baseUrl}/api/unknown/endpoint`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.deepEqual(body, {
      error: {
        code: 'NOT_FOUND',
        message: 'API route not found',
      },
    });
    assert.equal('stack' in body, false, 'Stack trace must not reach client');
  });

  it('rejects malformed JSON body with JSON 400 and uniform error format', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"invalid": json syntax here',
    });
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.deepEqual(body, {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON',
      },
    });
    assert.equal('stack' in body, false, 'Stack trace must not reach client');
  });

  it('serves static files from public/ including index.html', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/html/);

    const html = await res.text();
    assert.match(html, /Event Ticketing Platform/);
  });

  it('prevents path traversal outside of the public directory', async () => {
    // Attempting traversal to read package.json or README.md
    const attempts = [
      '/%2e%2e/README.md',
      '/..%2fREADME.md',
      '/%2e%2e%2fpackage.json',
      '/../../README.md',
    ];

    for (const path of attempts) {
      const res = await fetch(`${baseUrl}${path}`);
      assert.equal(res.status, 404);

      const body = await res.json();
      assert.deepEqual(body, {
        error: {
          code: 'NOT_FOUND',
          message: 'File not found',
        },
      });
    }
  });
});
