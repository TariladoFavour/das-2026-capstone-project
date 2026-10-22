// In-memory domain store and business rules for events, tiers, bookings, and waitlists.

import { newId, referenceCode } from './ids.js';
import { Queue } from './waitlistQueue.js';
import { DomainError } from './errors.js';
import { summarizeEvent } from './eventSearch.js';

export const MAX_TICKETS_PER_BOOKING = 10;

// Bookings in these states hold seats; cancelled bookings do not.
const HOLDS_SEATS = new Set(['pending', 'paid']);

export function createStore() {
  return {
    events: new Map(), // eventId -> event
    tiers: new Map(), // tierId -> tier
    bookings: new Map(), // bookingId -> booking
    bookingsByReference: new Map(), // reference -> booking (O(1) hash map lookup)
    waitlists: new Map(), // tierId -> Queue
  };
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }
  return value.trim();
}

function requireWholeNumber(value, field, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError('VALIDATION', `${field} must be a whole number of at least ${min}`);
  }
  return value;
}

function getEvent(store, eventId) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event not found');
  return event;
}

function getTier(store, tierId) {
  const tier = store.tiers.get(tierId);
  if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  return tier;
}

export function createEvent(store, { title, city, venue = '', startsAt, organizerId }) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }

  const event = {
    id: newId(),
    organizerId,
    title: requireText(title, 'Title'),
    city: requireText(city, 'City'),
    venue: String(venue || '').trim(),
    startsAt: date.toISOString(),
    status: 'draft',
    tierIds: [],
  };

  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, { name, priceCents, capacity }) {
  const event = getEvent(store, eventId);

  const tier = {
    id: newId(),
    eventId,
    name: requireText(name, 'Tier name'),
    // Money is stored as whole cents (never decimals).
    priceCents: requireWholeNumber(priceCents, 'priceCents', 0),
    capacity: requireWholeNumber(capacity, 'capacity', 1),
    sold: 0,
  };

  store.tiers.set(tier.id, tier);
  store.waitlists.set(tier.id, new Queue());
  event.tierIds.push(tier.id);
  return tier;
}

export function publishEvent(store, eventId) {
  const event = getEvent(store, eventId);
  if (event.tierIds.length === 0) {
    throw new DomainError('INVALID_STATE', 'Cannot publish an event with no ticket tiers');
  }
  event.status = 'published';
  return event;
}

export function unpublishEvent(store, eventId) {
  const event = getEvent(store, eventId);
  event.status = 'draft';
  return event;
}

export function listEventSummaries(store, { publishedOnly = true } = {}) {
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.status === 'published')
    .map((event) => summarizeEvent(event, event.tierIds.map((id) => store.tiers.get(id))));
}

export function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}

export function bookTickets(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
    throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
  }

  const left = seatsLeft(tier);
  if (left < quantity) {
    const message = left === 0 ? `${tier.name} is sold out` : `Only ${left} ticket(s) left in ${tier.name}`;
    throw new DomainError('SOLD_OUT', message, { seatsLeft: left });
  }

  tier.sold += quantity;

  let reference;
  do {
    reference = referenceCode();
  } while (store.bookingsByReference.has(reference));

  const booking = {
    id: newId(),
    reference,
    userId,
    tierId,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(reference, booking);
  return booking;
}

export function findBookingByReference(store, reference) {
  return store.bookingsByReference.get(reference);
}

export function cancelBooking(store, reference) {
  const booking = findBookingByReference(store, reference);
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
  if (!HOLDS_SEATS.has(booking.status)) {
    throw new DomainError('INVALID_STATE', `A ${booking.status} booking cannot be cancelled`);
  }
  getTier(store, booking.tierId).sold -= booking.quantity;
  booking.status = 'cancelled';
  return booking;
}

export function joinWaitlist(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
    throw new DomainError('VALIDATION', `quantity must be between 1 and ${MAX_TICKETS_PER_BOOKING}`);
  }
  if (seatsLeft(tier) >= quantity) {
    throw new DomainError('NOT_SOLD_OUT', 'Seats are available, so book them instead');
  }
  const queue = store.waitlists.get(tierId);
  queue.enqueue({ userId, quantity });
  return { position: queue.size };
}

export function offerNextOnWaitlist(store, tierId) {
  const tier = getTier(store, tierId);
  const queue = store.waitlists.get(tierId);
  const head = queue.peek();
  if (!head || seatsLeft(tier) < head.quantity) return undefined;
  return queue.dequeue();
}
