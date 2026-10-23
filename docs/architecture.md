# System Architecture: Event Ticketing Platform

## 1. Architectural Layers

The system follows a strict layered architecture where dependencies point only downwards. Nothing may call upwards.

```mermaid
flowchart TB
  routes["HTTP Routes"] --> services["Services"]
  services --> rules["Domain Rules"]
  services --> repositories["Repositories"]
  repositories --> data[("Data Store")]
```

### Layer Responsibilities and Constraints

- **HTTP Routes**: May parse incoming HTTP requests, decode parameters, and serialize JSON or HTML responses; may not execute business rules or interact directly with the database.
- **Services**: May orchestrate multi-step business workflows, coordinate domain rules, and call repositories; may not depend on HTTP request/response primitives or call back to routes.
- **Domain Rules**: May validate entity state transitions, enforce core ticketing rules, and operate as pure logic in memory; may not execute network/disk I/O or depend on repositories or services.
- **Repositories**: May perform CRUD queries and atomic transactions against SQLite/memory; may not make domain business decisions or call services or routes.
- **Data Store**: May persist structured records and enforce schema constraints; may not initiate calls to application layers.

---

## 2. Data Model

The domain consists of four primary entities: `USERS`, `EVENTS`, `TICKET_TIERS`, and `BOOKINGS`.

```mermaid
erDiagram
  USERS ||--o{ EVENTS : organizes
  USERS ||--o{ BOOKINGS : makes
  EVENTS ||--o{ TICKET_TIERS : offers
  TICKET_TIERS ||--o{ BOOKINGS : reserves

  USERS {
    string id PK
    string name
    string email
    string role
  }
  EVENTS {
    string id PK
    string organizer_id FK
    string title
    string city
    string venue
    datetime starts_at
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    integer price_cents
    integer capacity
    integer sold
  }
  BOOKINGS {
    string id PK
    string user_id FK
    string tier_id FK
    string reference
    integer quantity
    integer amount_cents
    string status
    datetime created_at
  }
```

---

## 3. Booking Life Cycle

The booking status progresses through an explicit finite state machine. `cancelled`, `refunded`, and `checked_in` are terminal states.

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid : payment completed
  pending --> cancelled : expired or user cancelled
  paid --> checked_in : ticket scanned at door
  paid --> refunded : refund processed
  paid --> cancelled : booking cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```
