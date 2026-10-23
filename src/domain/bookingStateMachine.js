// Booking lifecycle finite state machine.
// Defines allowed state transitions as pure data and enforces domain rules.

import { DomainError } from './errors.js';

export const BOOKING_STATES = Object.freeze([
  'pending',
  'paid',
  'cancelled',
  'refunded',
  'checked_in',
]);

// Allowed state transitions:
// - pending -> paid, cancelled
// - paid -> checked_in, refunded, cancelled
// - cancelled, refunded, checked_in are terminal (final)
export const BOOKING_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['paid', 'cancelled']),
  paid: Object.freeze(['checked_in', 'refunded', 'cancelled']),
  cancelled: Object.freeze([]),
  refunded: Object.freeze([]),
  checked_in: Object.freeze([]),
});

/**
 * Checks whether a transition from one state to another is permitted.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  if (!Object.hasOwn(BOOKING_TRANSITIONS, from)) {
    return false;
  }
  return BOOKING_TRANSITIONS[from].includes(to);
}

/**
 * Asserts that a transition is allowed.
 * Throws a DomainError with code INVALID_TRANSITION if the move is illegal.
 * @param {string} from
 * @param {string} to
 * @returns {true}
 */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Cannot transition booking status from "${from}" to "${to}"`
    );
  }
  return true;
}
