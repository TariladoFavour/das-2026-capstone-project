// Pure functions for event searching, filtering, and sorting.
// Inputs are never mutated; every function returns a new array.

import { mergeSort } from './sorting.js';
import { DomainError } from './errors.js';

/**
 * Summarizes an event and its tiers for listing, searching, and sorting.
 */
export function summarizeEvent(event, tiers = []) {
  const hasTiers = tiers.length > 0;
  const minPriceCents = hasTiers
    ? Math.min(...tiers.map((t) => t.priceCents))
    : null;
  const seatsLeft = tiers.reduce(
    (total, t) => total + Math.max(0, t.capacity - t.sold),
    0
  );

  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue || '',
    startsAt: event.startsAt,
    status: event.status,
    tierCount: tiers.length,
    minPriceCents,
    seatsLeft,
  };
}

/**
 * Validates and parses search date inputs.
 * If endOfDay is true and a date-only string (YYYY-MM-DD) is supplied,
 * adjusts timestamp to the end of that day (23:59:59.999Z).
 */
function parseDateParam(value, field, { endOfDay = false } = {}) {
  const str = String(value).trim();
  const time = new Date(str).getTime();
  if (Number.isNaN(time)) {
    throw new DomainError('VALIDATION', `${field} must be a valid date`);
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
  if (endOfDay && isDateOnly) {
    return time + 24 * 60 * 60 * 1000 - 1;
  }
  return time;
}

/**
 * Filters a list of event summaries according to the provided criteria.
 * Returns a new array; does not mutate input.
 */
export function filterEvents(summaries, criteria = {}) {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'summaries must be an array');
  }

  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;

  const fromTime = from !== undefined ? parseDateParam(from, 'from') : undefined;
  const toTime = to !== undefined ? parseDateParam(to, 'to', { endOfDay: true }) : undefined;

  if (maxPriceCents !== undefined) {
    if (!Number.isInteger(maxPriceCents) || maxPriceCents < 0) {
      throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number of cents (>= 0)');
    }
  }

  const query = typeof q === 'string' && q.trim() !== '' ? q.trim().toLowerCase() : null;
  const targetCity = typeof city === 'string' && city.trim() !== '' ? city.trim().toLowerCase() : null;

  return summaries.filter((event) => {
    // q matches title or venue, ignoring case
    if (query) {
      const haystack = `${event.title} ${event.venue}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    // city matches exactly, ignoring case
    if (targetCity) {
      if (event.city.toLowerCase() !== targetCity) return false;
    }

    // from and to date range checks (inclusive)
    const eventTime = new Date(event.startsAt).getTime();
    if (fromTime !== undefined && eventTime < fromTime) return false;
    if (toTime !== undefined && eventTime > toTime) return false;

    // maxPriceCents: compares with cheapest tier.
    // Events with no tiers (minPriceCents === null) are left out of price filters.
    if (maxPriceCents !== undefined) {
      if (event.minPriceCents === null || event.minPriceCents > maxPriceCents) {
        return false;
      }
    }

    // onlyAvailable: filters out sold out events
    if (onlyAvailable && event.seatsLeft <= 0) {
      return false;
    }

    return true;
  });
}

const compareStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Tie-breaker: title case-insensitively, then id
const tieBreaker = (a, b) =>
  compareStr(a.title.toLowerCase(), b.title.toLowerCase()) || compareStr(a.id, b.id);

const SORT_COMPARATORS = {
  // Earliest first
  date: (a, b) => {
    const diff = compareStr(a.startsAt, b.startsAt);
    return diff !== 0 ? diff : tieBreaker(a, b);
  },
  // Cheapest first; events with no price go last
  price: (a, b) => {
    const priceA = a.minPriceCents ?? Infinity;
    const priceB = b.minPriceCents ?? Infinity;
    if (priceA !== priceB) return priceA < priceB ? -1 : 1;
    return tieBreaker(a, b);
  },
  // Most seats left first
  availability: (a, b) => {
    const seatDiff = b.seatsLeft - a.seatsLeft;
    return seatDiff !== 0 ? seatDiff : tieBreaker(a, b);
  },
};

export const SORT_KEYS = Object.keys(SORT_COMPARATORS);

/**
 * Sorts event summaries by the requested criteria using custom mergeSort.
 * Always breaks ties by title, then id.
 * Returns a new array.
 */
export function sortEvents(summaries, sortBy = 'date') {
  if (!Array.isArray(summaries)) {
    throw new DomainError('VALIDATION', 'summaries must be an array');
  }

  if (!Object.hasOwn(SORT_COMPARATORS, sortBy)) {
    throw new DomainError(
      'VALIDATION',
      `Unknown sort option: "${sortBy}". Must be one of: ${SORT_KEYS.join(', ')}`
    );
  }

  return mergeSort(summaries, SORT_COMPARATORS[sortBy]);
}

/**
 * Filters and then sorts event summaries.
 */
export function searchEvents(summaries, criteria = {}, sortBy = 'date') {
  const filtered = filterEvents(summaries, criteria);
  return sortEvents(filtered, sortBy);
}
