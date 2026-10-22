import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  bookTickets,
  listEventSummaries,
} from '../src/domain/inventory.js';
import {
  filterEvents,
  sortEvents,
  searchEvents,
  summarizeEvent,
} from '../src/domain/eventSearch.js';
import { DomainError } from '../src/domain/errors.js';

const titles = (events) => events.map((e) => e.title);

describe('Event Search & User Story S05', () => {
  let summaries;

  before(() => {
    const store = createStore();

    const helper = (title, city, venue, startsAt, tiers, { publish = true } = {}) => {
      const event = createEvent(store, { title, city, venue, startsAt, organizerId: 'org' });
      const createdTiers = tiers.map((t) => addTier(store, event.id, t));
      if (publish) {
        publishEvent(store, event.id);
      }
      return { event, tiers: createdTiers };
    };

    // Lagos Tech Meetup: 2026-12-05 at 17:00 (5 PM)
    helper(
      'Lagos Tech Meetup',
      'Lagos',
      'Yaba Hall',
      '2026-12-05T17:00:00Z',
      [{ name: 'General', priceCents: 10000, capacity: 100 }]
    );

    // Abuja Jazz Night: 2026-12-10 at 19:00
    helper(
      'Abuja Jazz Night',
      'Abuja',
      'Transcorp Dome',
      '2026-12-10T19:00:00Z',
      [{ name: 'Standard', priceCents: 3000, capacity: 50 }]
    );

    // Food Festival (Free entry event) on 2026-12-05 at 10:00 AM (earlier on same day)
    helper(
      'Food Festival',
      'Lagos',
      'Victoria Island Grounds',
      '2026-12-05T10:00:00Z',
      [{ name: 'Free Pass', priceCents: 0, capacity: 500 }]
    );

    // Sold out event
    const soldOut = helper(
      'Sold Out Gig',
      'Ibadan',
      'Liberty Arena',
      '2026-12-20T20:00:00Z',
      [{ name: 'VIP', priceCents: 5000, capacity: 2 }]
    );
    bookTickets(store, soldOut.tiers[0].id, 'buyer-1', 2);

    // Draft event (should be excluded from published summaries)
    helper(
      'Unpublished Draft Workshop',
      'Lagos',
      'Private Room',
      '2026-12-01T09:00:00Z',
      [{ name: 'Standard', priceCents: 2000, capacity: 20 }],
      { publish: false }
    );

    summaries = listEventSummaries(store);
  });

  it('excludes draft events from public summaries list', () => {
    assert.equal(summaries.length, 4);
    assert.ok(!titles(summaries).includes('Unpublished Draft Workshop'));
  });

  describe('S05 Acceptance Criteria: Filtering', () => {
    it('searches by q (e.g. "JAZZ") matching title or venue case-insensitively', () => {
      const jazzResult = filterEvents(summaries, { q: 'JAZZ' });
      assert.deepEqual(titles(jazzResult), ['Abuja Jazz Night']);

      const venueResult = filterEvents(summaries, { q: 'yaba' });
      assert.deepEqual(titles(venueResult), ['Lagos Tech Meetup']);
    });

    it('filters by city "lagos" ignoring casing', () => {
      const lagosEvents = filterEvents(summaries, { city: 'lagos' });
      assert.deepEqual(titles(lagosEvents).sort(), ['Food Festival', 'Lagos Tech Meetup']);
    });

    it('filters by maxPriceCents including free events and leaves out events without tiers', () => {
      const upTo3000 = filterEvents(summaries, { maxPriceCents: 3000 });
      assert.deepEqual(titles(upTo3000).sort(), ['Abuja Jazz Night', 'Food Festival']);

      const freeOnly = filterEvents(summaries, { maxPriceCents: 0 });
      assert.deepEqual(titles(freeOnly), ['Food Festival']);

      // An event with no tiers has minPriceCents = null and should be excluded from price filters
      const dummyNoTier = {
        id: 'no-tier',
        title: 'No Tier Event',
        city: 'Lagos',
        venue: '',
        startsAt: '2026-12-05T12:00:00Z',
        minPriceCents: null,
        seatsLeft: 0,
      };
      assert.deepEqual(filterEvents([dummyNoTier], { maxPriceCents: 5000 }), []);
    });

    it('filters by date range where date-only "to" includes the whole day (event at 5 PM on 5 Dec)', () => {
      // Event is at 2026-12-05T17:00:00Z. Filtering to '2026-12-05' should include it!
      const onDay = filterEvents(summaries, { from: '2026-12-05', to: '2026-12-05' });
      assert.deepEqual(titles(onDay).sort(), ['Food Festival', 'Lagos Tech Meetup']);
    });

    it('filters by onlyAvailable to exclude sold-out events', () => {
      const available = filterEvents(summaries, { onlyAvailable: true });
      assert.ok(!titles(available).includes('Sold Out Gig'));
      assert.equal(available.length, 3);
    });

    it('rejects invalid date format with VALIDATION', () => {
      assert.throws(
        () => filterEvents(summaries, { from: 'invalid-date' }),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
      assert.throws(
        () => filterEvents(summaries, { to: 'bad-date' }),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
    });

    it('rejects non-integer or negative maxPriceCents with VALIDATION', () => {
      assert.throws(
        () => filterEvents(summaries, { maxPriceCents: -1 }),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
      assert.throws(
        () => filterEvents(summaries, { maxPriceCents: 25.5 }),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
    });
  });

  describe('S05 Acceptance Criteria: Sorting', () => {
    it('sorts by date (earliest first); two events on the same day put earlier time first', () => {
      // Food Festival is 2026-12-05T10:00:00Z, Lagos Tech Meetup is 2026-12-05T17:00:00Z
      const sorted = sortEvents(summaries, 'date');
      assert.deepEqual(titles(sorted), [
        'Food Festival',
        'Lagos Tech Meetup',
        'Abuja Jazz Night',
        'Sold Out Gig',
      ]);
    });

    it('two events with identical timestamps stay in title order', () => {
      const sameTimeEvents = [
        { id: '2', title: 'Beta Event', city: 'A', venue: '', startsAt: '2026-12-05T12:00:00Z', minPriceCents: 100, seatsLeft: 10 },
        { id: '1', title: 'Alpha Event', city: 'A', venue: '', startsAt: '2026-12-05T12:00:00Z', minPriceCents: 100, seatsLeft: 10 },
      ];
      const sorted = sortEvents(sameTimeEvents, 'date');
      assert.deepEqual(titles(sorted), ['Alpha Event', 'Beta Event']);
    });

    it('sorts by price (cheapest first; no price last)', () => {
      const sorted = sortEvents(summaries, 'price');
      assert.deepEqual(titles(sorted), [
        'Food Festival', // 0
        'Abuja Jazz Night', // 3000
        'Sold Out Gig', // 5000
        'Lagos Tech Meetup', // 10000
      ]);

      const withNoPrice = [
        { id: '1', title: 'Has Price', startsAt: '2026-12-01', minPriceCents: 500, seatsLeft: 1 },
        { id: '2', title: 'No Price', startsAt: '2026-12-01', minPriceCents: null, seatsLeft: 0 },
      ];
      assert.deepEqual(titles(sortEvents(withNoPrice, 'price')), ['Has Price', 'No Price']);
    });

    it('sorts by availability (most seats left first)', () => {
      const sorted = sortEvents(summaries, 'availability');
      assert.deepEqual(titles(sorted), [
        'Food Festival', // 500 seats
        'Lagos Tech Meetup', // 100 seats
        'Abuja Jazz Night', // 50 seats
        'Sold Out Gig', // 0 seats
      ]);
    });

    it('rejects unknown sort options with VALIDATION', () => {
      assert.throws(
        () => sortEvents(summaries, 'popularity'),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
      assert.throws(
        () => sortEvents(summaries, '__proto__'),
        (err) => err instanceof DomainError && err.code === 'VALIDATION'
      );
    });
  });

  describe('Immutability and Edge Cases', () => {
    it('never modifies the original list when filtered or sorted', () => {
      const originalSnapshot = JSON.stringify(summaries);
      filterEvents(summaries, { city: 'lagos' });
      sortEvents(summaries, 'price');
      searchEvents(summaries, { q: 'jazz' }, 'availability');
      assert.equal(JSON.stringify(summaries), originalSnapshot, 'Original array must remain unchanged');
    });

    it('handles an empty list for both filter and sort', () => {
      assert.deepEqual(filterEvents([], { city: 'Lagos' }), []);
      assert.deepEqual(sortEvents([], 'date'), []);
      assert.deepEqual(searchEvents([], { maxPriceCents: 1000 }, 'price'), []);
    });

    it('searchEvents applies filter first then sort', () => {
      const result = searchEvents(summaries, { city: 'Lagos' }, 'price');
      assert.deepEqual(titles(result), ['Food Festival', 'Lagos Tech Meetup']);
    });
  });
});
