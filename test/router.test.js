import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/http/router.js';

describe('HTTP Router', () => {
  it('registers and matches routes with extracted and URL-decoded parameters', () => {
    const router = new Router();
    const handler = () => {};

    router.get('/api/events/:eventId/tiers/:tierId', handler);

    const match = router.match('GET', '/api/events/lagos%20summit/tiers/tier-123');
    assert.ok(match);
    assert.equal(match.handler, handler);
    assert.deepEqual(match.params, {
      eventId: 'lagos summit',
      tierId: 'tier-123',
    });
  });

  it('differentiates routes by HTTP method', () => {
    const router = new Router();
    const getHandler = () => 'GET';
    const postHandler = () => 'POST';

    router.get('/api/events', getHandler);
    router.post('/api/events', postHandler);

    assert.equal(router.match('GET', '/api/events')?.handler, getHandler);
    assert.equal(router.match('POST', '/api/events')?.handler, postHandler);
    assert.equal(router.match('DELETE', '/api/events'), null);
  });

  it('returns null for unmatched paths and mismatched segment counts', () => {
    const router = new Router();
    router.get('/api/events/:id', () => {});

    assert.equal(router.match('GET', '/api/events'), null);
    assert.equal(router.match('GET', '/api/events/1/extra'), null);
    assert.equal(router.match('GET', '/api/users/1'), null);
  });

  it('validates registration inputs and rejects invalid route signatures', () => {
    const router = new Router();
    assert.throws(() => router.add('', '/path', () => {}), TypeError);
    assert.throws(() => router.add('GET', 'no-leading-slash', () => {}), TypeError);
    assert.throws(() => router.add('GET', '/path', 'not-a-function'), TypeError);
  });
});
