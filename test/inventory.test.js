import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  unpublishEvent,
  listEventSummaries,
  bookTickets,
  cancelBooking,
  joinWaitlist,
  offerNextOnWaitlist,
  findBookingByReference,
  seatsLeft,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const expectDomainErrorCode = (fn, code) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof DomainError, `Expected DomainError, got ${error?.name || error}`);
    assert.equal(error.code, code, `Expected code ${code}, got ${error.code}`);
    return true;
  });
};

describe('Domain Inventory & User Stories S02, S03, S04, S06', () => {
  let store;

  beforeEach(() => {
    store = createStore();
  });

  describe('S02: Organizer creates an event', () => {
    it('creates an event as draft and excludes it from public listing', () => {
      const event = createEvent(store, {
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        venue: 'Yaba Hub',
        startsAt: '2026-12-05T17:00:00Z',
        organizerId: 'org-1',
      });

      assert.ok(event.id, 'Event should have a unique ID');
      assert.equal(event.status, 'draft');
      assert.equal(event.title, 'Lagos Tech Meetup');
      assert.equal(event.city, 'Lagos');

      // Drafts must not appear on public list
      const publicList = listEventSummaries(store, { publishedOnly: true });
      assert.equal(publicList.length, 0);

      // But should appear when drafts are requested
      const allEvents = listEventSummaries(store, { publishedOnly: false });
      assert.equal(allEvents.length, 1);
      assert.equal(allEvents[0].id, event.id);
    });

    it('rejects event creation with VALIDATION if title is missing', () => {
      expectDomainErrorCode(() => {
        createEvent(store, {
          title: '   ',
          city: 'Lagos',
          startsAt: '2026-12-05T17:00:00Z',
          organizerId: 'org-1',
        });
      }, 'VALIDATION');
    });

    it('rejects event creation with VALIDATION if city is missing', () => {
      expectDomainErrorCode(() => {
        createEvent(store, {
          title: 'Concert',
          city: '',
          startsAt: '2026-12-05T17:00:00Z',
          organizerId: 'org-1',
        });
      }, 'VALIDATION');
    });

    it('rejects event creation with VALIDATION if date is invalid', () => {
      expectDomainErrorCode(() => {
        createEvent(store, {
          title: 'Concert',
          city: 'Abuja',
          startsAt: 'not-a-real-date',
          organizerId: 'org-1',
        });
      }, 'VALIDATION');
    });
  });

  describe('S03: Organizer adds ticket tiers', () => {
    let event;

    beforeEach(() => {
      event = createEvent(store, {
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        startsAt: '2026-12-05T17:00:00Z',
        organizerId: 'org-1',
      });
    });

    it('adds tier with 0 sold and full capacity remaining', () => {
      const tier = addTier(store, event.id, {
        name: 'General',
        priceCents: 500000,
        capacity: 100,
      });

      assert.ok(tier.id);
      assert.equal(tier.name, 'General');
      assert.equal(tier.priceCents, 500000);
      assert.equal(tier.capacity, 100);
      assert.equal(tier.sold, 0);
      assert.equal(seatsLeft(tier), 100);
    });

    it('rejects non-integer price with VALIDATION', () => {
      expectDomainErrorCode(() => {
        addTier(store, event.id, { name: 'VIP', priceCents: 19.99, capacity: 50 });
      }, 'VALIDATION');
    });

    it('rejects capacity less than 1 with VALIDATION', () => {
      expectDomainErrorCode(() => {
        addTier(store, event.id, { name: 'VIP', priceCents: 1000, capacity: 0 });
      }, 'VALIDATION');
      expectDomainErrorCode(() => {
        addTier(store, event.id, { name: 'VIP', priceCents: 1000, capacity: -5 });
      }, 'VALIDATION');
    });

    it('rejects non-existent eventId with NOT_FOUND', () => {
      expectDomainErrorCode(() => {
        addTier(store, 'non-existent-id', { name: 'VIP', priceCents: 1000, capacity: 50 });
      }, 'NOT_FOUND');
    });
  });

  describe('S04: Publishing and unpublishing events', () => {
    let event;

    beforeEach(() => {
      event = createEvent(store, {
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        startsAt: '2026-12-05T17:00:00Z',
        organizerId: 'org-1',
      });
    });

    it('publishes a draft event that has at least one tier', () => {
      addTier(store, event.id, { name: 'General', priceCents: 1000, capacity: 50 });
      const published = publishEvent(store, event.id);

      assert.equal(published.status, 'published');
      const publicList = listEventSummaries(store, { publishedOnly: true });
      assert.equal(publicList.length, 1);
      assert.equal(publicList[0].id, event.id);
    });

    it('rejects publishing an event with no tiers with INVALID_STATE', () => {
      expectDomainErrorCode(() => {
        publishEvent(store, event.id);
      }, 'INVALID_STATE');
    });

    it('rejects publishing a non-existent event with NOT_FOUND', () => {
      expectDomainErrorCode(() => {
        publishEvent(store, 'unknown-event-id');
      }, 'NOT_FOUND');
    });

    it('unpublishes an event back to draft', () => {
      addTier(store, event.id, { name: 'General', priceCents: 1000, capacity: 50 });
      publishEvent(store, event.id);
      assert.equal(event.status, 'published');

      unpublishEvent(store, event.id);
      assert.equal(event.status, 'draft');
      assert.equal(listEventSummaries(store, { publishedOnly: true }).length, 0);
    });
  });

  describe('S06: Booking tickets', () => {
    let event;
    let tier;

    beforeEach(() => {
      event = createEvent(store, {
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        startsAt: '2026-12-05T17:00:00Z',
        organizerId: 'org-1',
      });
      tier = addTier(store, event.id, { name: 'General', priceCents: 2500, capacity: 3 });
      publishEvent(store, event.id);
    });

    it('creates a pending booking for requested seats and calculates total in whole cents', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);

      assert.ok(booking.id);
      assert.equal(booking.quantity, 2);
      assert.equal(booking.amountCents, 5000);
      assert.equal(booking.status, 'pending');
      assert.equal(seatsLeft(tier), 1);
    });

    it('rejects with SOLD_OUT and changes nothing when requesting more seats than available', () => {
      bookTickets(store, tier.id, 'ada', 2);
      assert.equal(seatsLeft(tier), 1);

      expectDomainErrorCode(() => {
        bookTickets(store, tier.id, 'bayo', 2);
      }, 'SOLD_OUT');

      // State remains completely unchanged
      assert.equal(seatsLeft(tier), 1);
      assert.equal(tier.sold, 2);
    });

    it('validates booking quantity between 1 and 10 with VALIDATION error', () => {
      for (const invalid of [0, -1, 1.5, 11, '2', null, undefined]) {
        expectDomainErrorCode(() => {
          bookTickets(store, tier.id, 'ada', invalid);
        }, 'VALIDATION');
      }
    });

    it('finds booking by reference code in O(1)', () => {
      const booking = bookTickets(store, tier.id, 'ada', 1);
      assert.match(booking.reference, /^[A-Z2-9]{8}$/);

      const found = findBookingByReference(store, booking.reference);
      assert.equal(found, booking);
      assert.equal(findBookingByReference(store, 'NONEXIST8'), undefined);
    });
  });

  describe('Booking cancellations and Waitlist (All Domain Error Codes)', () => {
    let event;
    let tier;

    beforeEach(() => {
      event = createEvent(store, {
        title: 'Exclusive Show',
        city: 'Lagos',
        startsAt: '2026-12-10T20:00:00Z',
        organizerId: 'org-1',
      });
      tier = addTier(store, event.id, { name: 'VIP', priceCents: 10000, capacity: 2 });
      publishEvent(store, event.id);
    });

    it('cancelling releases seats back to inventory', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);
      assert.equal(seatsLeft(tier), 0);

      const cancelled = cancelBooking(store, booking.reference);
      assert.equal(cancelled.status, 'cancelled');
      assert.equal(seatsLeft(tier), 2);
    });

    it('cancelling twice throws INVALID_STATE and does not double-release seats', () => {
      const booking = bookTickets(store, tier.id, 'ada', 2);
      cancelBooking(store, booking.reference);

      expectDomainErrorCode(() => {
        cancelBooking(store, booking.reference);
      }, 'INVALID_STATE');

      assert.equal(seatsLeft(tier), 2);
    });

    it('cancelling a non-existent reference throws NOT_FOUND', () => {
      expectDomainErrorCode(() => {
        cancelBooking(store, 'UNKNOWN9');
      }, 'NOT_FOUND');
    });

    it('joining waitlist when seats are available throws NOT_SOLD_OUT', () => {
      expectDomainErrorCode(() => {
        joinWaitlist(store, tier.id, 'ada', 1);
      }, 'NOT_SOLD_OUT');
    });

    it('enqueues to waitlist when sold out and offers to head when seats free up', () => {
      const b1 = bookTickets(store, tier.id, 'ada', 2);
      assert.equal(seatsLeft(tier), 0);

      const pos1 = joinWaitlist(store, tier.id, 'bayo', 1);
      const pos2 = joinWaitlist(store, tier.id, 'chidi', 2);

      assert.deepEqual(pos1, { position: 1 });
      assert.deepEqual(pos2, { position: 2 });

      // No seats free yet
      assert.equal(offerNextOnWaitlist(store, tier.id), undefined);

      // Cancel b1 to release 2 seats
      cancelBooking(store, b1.reference);
      assert.equal(seatsLeft(tier), 2);

      // Bayo needs 1 seat, available is 2 -> dequeued first
      const nextOffer = offerNextOnWaitlist(store, tier.id);
      assert.deepEqual(nextOffer, { userId: 'bayo', quantity: 1 });
    });
  });
});
