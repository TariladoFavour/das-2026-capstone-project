// Merge sort: O(n log n) in all cases, and STABLE.
// Stable means equal elements retain their original relative order.
// This is essential when sorting events with identical dates or prices.

const defaultCompare = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * Pure, stable merge sort implementation.
 * Never modifies the input array; always returns a new sorted array.
 *
 * @template T
 * @param {T[]} items
 * @param {(a: T, b: T) => number} [compare]
 * @returns {T[]}
 */
export function mergeSort(items, compare = defaultCompare) {
  if (!Array.isArray(items)) {
    throw new TypeError('mergeSort expects an array');
  }

  // Base case: empty or single element is already sorted.
  if (items.length <= 1) {
    return [...items];
  }

  const mid = Math.floor(items.length / 2);
  const leftHalf = mergeSort(items.slice(0, mid), compare);
  const rightHalf = mergeSort(items.slice(mid), compare);

  return merge(leftHalf, rightHalf, compare);
}

/**
 * Merges two sorted arrays stably.
 * Taking from the left partition on equality (compare <= 0) ensures stability.
 */
function merge(left, right, compare) {
  const result = new Array(left.length + right.length);
  let l = 0;
  let r = 0;
  let i = 0;

  while (l < left.length && r < right.length) {
    if (compare(left[l], right[r]) <= 0) {
      result[i++] = left[l++];
    } else {
      result[i++] = right[r++];
    }
  }

  while (l < left.length) {
    result[i++] = left[l++];
  }
  while (r < right.length) {
    result[i++] = right[r++];
  }

  return result;
}
