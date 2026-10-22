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
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**

### Prompt 2:
- **What I asked:**
- **What came back:**
- **What was wrong (or "nothing"):**
