import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSort } from '../src/domain/sorting.js';

describe('mergeSort', () => {
  it('sorts numbers in ascending order with default comparator', () => {
    const input = [9, 3, 7, 1, 4, 8, 2, 6, 5];
    const sorted = mergeSort(input);
    assert.deepEqual(sorted, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('handles empty and single-element arrays', () => {
    assert.deepEqual(mergeSort([]), []);
    assert.deepEqual(mergeSort([42]), [42]);
  });

  it('never mutates the input array', () => {
    const original = [5, 2, 8, 1];
    const copy = [...original];
    const result = mergeSort(original);
    assert.deepEqual(original, copy, 'Original array should not be modified');
    assert.notEqual(result, original, 'Must return a new array');
  });

  it('is stable: elements comparing equal maintain their relative order', () => {
    const items = [
      { id: 1, key: 'X', order: 'first' },
      { id: 2, key: 'Y', order: 'second' },
      { id: 3, key: 'X', order: 'third' },
      { id: 4, key: 'Y', order: 'fourth' },
      { id: 5, key: 'X', order: 'fifth' },
    ];

    const sorted = mergeSort(items, (a, b) => a.key.localeCompare(b.key));
    const xItems = sorted.filter((i) => i.key === 'X').map((i) => i.order);
    const yItems = sorted.filter((i) => i.key === 'Y').map((i) => i.order);

    assert.deepEqual(xItems, ['first', 'third', 'fifth'], 'Equal items should preserve relative order');
    assert.deepEqual(yItems, ['second', 'fourth'], 'Equal items should preserve relative order');
  });

  it('works with custom comparators (e.g. descending order)', () => {
    const numbers = [10, 50, 20, 40, 30];
    const descending = mergeSort(numbers, (a, b) => b - a);
    assert.deepEqual(descending, [50, 40, 30, 20, 10]);
  });

  it('produces the same result as built-in sort on random datasets', () => {
    const data = Array.from({ length: 300 }, () => Math.floor(Math.random() * 1000));
    const expected = [...data].sort((a, b) => a - b);
    const actual = mergeSort(data, (a, b) => a - b);
    assert.deepEqual(actual, expected);
  });

  it('throws TypeError when given a non-array input', () => {
    assert.throws(() => mergeSort(null), TypeError);
    assert.throws(() => mergeSort('not an array'), TypeError);
  });
});
