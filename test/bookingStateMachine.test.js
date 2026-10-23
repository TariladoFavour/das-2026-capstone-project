import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_STATES,
  BOOKING_TRANSITIONS,
  canTransition,
  assertTransition,
} from '../src/domain/bookingStateMachine.js';
import { DomainError } from '../src/domain/errors.js';

describe('Booking State Machine', () => {
  it('allows every explicitly permitted transition', () => {
    for (const [fromState, allowedNextStates] of Object.entries(BOOKING_TRANSITIONS)) {
      for (const toState of allowedNextStates) {
        assert.equal(
          canTransition(fromState, toState),
          true,
          `Expected transition from ${fromState} to ${toState} to be allowed`
        );
        assert.equal(
          assertTransition(fromState, toState),
          true,
          `Expected assertTransition(${fromState}, ${toState}) to succeed`
        );
      }
    }
  });

  it('rejects every transition that is not allowed with INVALID_TRANSITION', () => {
    for (const fromState of BOOKING_STATES) {
      for (const toState of BOOKING_STATES) {
        const isPermitted = BOOKING_TRANSITIONS[fromState]?.includes(toState);
        if (!isPermitted) {
          assert.equal(
            canTransition(fromState, toState),
            false,
            `Transition ${fromState} -> ${toState} must not be allowed`
          );
          assert.throws(
            () => assertTransition(fromState, toState),
            (err) => {
              assert.ok(err instanceof DomainError);
              assert.equal(err.code, 'INVALID_TRANSITION');
              return true;
            }
          );
        }
      }
    }
  });

  it('verifies that cancelled, refunded, and checked_in are terminal states', () => {
    const terminalStates = ['cancelled', 'refunded', 'checked_in'];
    for (const terminal of terminalStates) {
      assert.deepEqual(BOOKING_TRANSITIONS[terminal], [], `${terminal} must have no outgoing transitions`);
      for (const anyState of BOOKING_STATES) {
        assert.equal(canTransition(terminal, anyState), false);
        assert.throws(
          () => assertTransition(terminal, anyState),
          (err) => err instanceof DomainError && err.code === 'INVALID_TRANSITION'
        );
      }
    }
  });

  it('rejects completely unknown state strings', () => {
    assert.equal(canTransition('unknown_state', 'paid'), false);
    assert.equal(canTransition('pending', 'bogus_state'), false);
    assert.throws(
      () => assertTransition('unknown_state', 'paid'),
      (err) => err instanceof DomainError && err.code === 'INVALID_TRANSITION'
    );
  });
});
