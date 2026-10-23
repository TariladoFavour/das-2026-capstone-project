# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

## Build 1

### Prompt 1: Domain core in the terminal (docs/build-1.md)
- **What I asked:** Create domain core modules (DomainError, newId, referenceCode, Queue as linked list, inventory store with booking and waitlist rules) and verification scripts (demo.js, benchmark-lookup.js).
- **What came back:** Working domain models, FIFO linked list Queue, and scripts comparing Map.get with Array.find.
- **What was wrong (or "nothing"):** It said nothing was wrong, but userId is not validated in bookTickets or joinWaitlist. tier.sold is increased before the booking is created, so a failure could leave seats taken. It added an extra function I didn't ask for, and left an unresolved question about waitlist blocking.
- **What I checked myself:**  I searched for Math.random and .shift( and neither is used in real code, I read bookTickets and cancelBooking, and I ran npm run demo and npm run benchmark. Both worked, and Map.get was about 1,108x faster than Array.find.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Replace existing sorting.js, eventSearch.js, inventory.js additions (publishEvent, listEventSummaries), and test suite with fresh implementations covering acceptance criteria for S02, S03, S04, S05, S06, and S16.
- **What came back:** Custom stable mergeSort, pure eventSearch functions with tie-breaking, publishEvent/unpublishEvent, and 48 passing tests across 4 test suites.
- **What was wrong (or "nothing"):** The AI initially added unpublishEvent which wasn't strictly in the prompt's numbered list (though S04's title mentioned unpublishing). I verified that date-only "to" filters correctly span until the end of the day, that events with no tiers are excluded when filtering by maxPriceCents, and that mergeSort is genuinely stable without calling Array.prototype.sort. All 48 tests passed.

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

## Build 3

### Prompt 1: Build 3 prompt (docs/build-3.md)

- **What I asked:** Gave the Build 3 prompt: architecture document, booking state machine, Node HTTP server with a /health route, startup configuration and tests.
- **What came back:** The AI changed 10 files (+503, -248). It kept error responses free of stack traces, added path traversal protection for the public/ folder, and kept route handlers thin by using assertTransition. 61 tests pass, 0 fail.
- **What was wrong (or "nothing"):** Many of these files already existed from my instructor's update, and the AI replaced them with its own versions. It rewrote a lot of code (248 lines removed), more than I read line by line, so I cannot say every change was needed. I ran npm test and the tests passed.