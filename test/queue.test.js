import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Queue } from '../src/domain/waitlistQueue.js';

describe('Waitlist Queue Linked List', () => {
  it('operates in strict first-in, first-out (FIFO) order', () => {
    const queue = new Queue();
    queue.enqueue({ name: 'First' });
    queue.enqueue({ name: 'Second' });
    queue.enqueue({ name: 'Third' });

    assert.deepEqual(queue.dequeue(), { name: 'First' });
    assert.deepEqual(queue.dequeue(), { name: 'Second' });
    assert.deepEqual(queue.dequeue(), { name: 'Third' });
  });

  it('tracks size dynamically in O(1)', () => {
    const queue = new Queue();
    assert.equal(queue.size, 0);

    queue.enqueue(10);
    assert.equal(queue.size, 1);

    queue.enqueue(20);
    assert.equal(queue.size, 2);

    queue.dequeue();
    assert.equal(queue.size, 1);

    queue.dequeue();
    assert.equal(queue.size, 0);
  });

  it('peeks at the head element without removing it', () => {
    const queue = new Queue();
    assert.equal(queue.peek(), undefined);

    queue.enqueue('alpha');
    queue.enqueue('beta');

    assert.equal(queue.peek(), 'alpha');
    assert.equal(queue.size, 2);
  });

  it('safely handles empty state and re-enqueueing after exhaustion', () => {
    const queue = new Queue();
    assert.equal(queue.dequeue(), undefined);

    queue.enqueue('item-1');
    assert.equal(queue.dequeue(), 'item-1');
    assert.equal(queue.dequeue(), undefined);

    // Can enqueue again cleanly
    queue.enqueue('item-2');
    assert.equal(queue.size, 1);
    assert.equal(queue.peek(), 'item-2');
    assert.deepEqual(queue.toArray(), ['item-2']);
  });
});
