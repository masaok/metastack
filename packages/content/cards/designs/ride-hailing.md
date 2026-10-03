---
id: ride-hailing
deck: designs
type: design
difficulty: 3
tags: [geo, realtime, messaging]
prompt: >
  Design the core of a ride-hailing service like Uber: track driver locations,
  match riders to nearby drivers, and run the trip lifecycle.
keyPoints:
  - Ingests high-frequency driver location updates into an in-memory geospatial index (geohash/H3 cells), not a relational table
  - Matching finds candidates in nearby cells, filters by availability, ranks by ETA from a routing service, and offers the trip with a timeout
  - Models the trip as a state machine (requested, matched, en route, in progress, completed) with idempotent transitions
  - Uses a persistent connection or push channel to drivers and riders for offers and live tracking
  - Addresses consistency for concurrent matches (a driver must not be assigned two trips) with locks or a single-writer per region
eli5:
  - Drivers report where they are every few seconds, so keep those positions in memory on a map grid instead of in ordinary database rows
  - To match a rider, look in the nearby grid squares, drop busy drivers, sort by arrival time and give the best one a few seconds to accept
  - A trip moves through fixed steps from requested to completed, and repeating a step changes nothing
  - Keep a line open to each phone so offers and the moving car on the map arrive right away
  - One driver must never get two trips at once, so only one decision-maker per area hands out drivers, or it locks the driver first
distractors:
  - text: Write every driver location update as a row in a relational table and query it with a bounding box
    why: Millions of location writes a second with constant nearby queries overwhelm a relational table. This belongs in an in-memory geospatial index
  - text: Match the rider to the driver nearest in a straight line, with no need for travel-time estimates
    why: Rivers, one-way streets and traffic make the nearest driver by distance often not the quickest to arrive. Rank by ETA
  - text: Offer the same trip to several drivers and assign all who accept
    why: A trip needs exactly one driver. Offers must be exclusive, or the others must be cancelled atomically
followUps:
  - How do you prevent two riders from being matched to the same driver at the same instant?
  - How would surge pricing be computed and kept consistent with what the rider was quoted?
stages:
  - name: Requirements
    keyPoints:
      - Drivers share location, riders request trips, system matches, both see live tracking, trip states and payment at the end
      - Match within seconds, location updates every few seconds, high availability per city, correctness on assignment
  - name: Estimates
    keyPoints:
      - e.g. 1M active drivers × one update per 4 s → 250k location writes/s, millions of reads for matching and tracking
      - Trips are low volume by comparison, tens of thousands per minute globally
  - name: API
    keyPoints:
      - Driver, POST /location (via persistent channel), accept/decline offers, update trip status
      - Rider, POST /trips with pickup and destination, GET trip status/stream, cancel
  - name: Data model
    keyPoints:
      - Live, driver_id → (cell, lat, lng, status, updated_at) in memory, cell → set of driver ids
      - Durable, trips(id, rider, driver, state, pickup, dropoff, fare, timestamps), location history appended to a log for analytics
  - name: High-level design
    keyPoints:
      - Location service ingests updates and maintains the geo index, matching service queries it, trip service owns the state machine
      - Routing/ETA service, pricing service, notification channels to clients
  - name: Deep dives
    keyPoints:
      - Geo index with H3 or geohash cells, query the pickup cell plus neighbours, then exact distance and ETA
      - Dispatch as an offer with a 10-15 s timeout, lock the driver during the offer, release on decline
      - Sharding everything by city/region since matching is inherently local
  - name: Bottlenecks and failure
    keyPoints:
      - Location write volume handled by in-memory stores partitioned by region, with sampling to durable storage
      - Double assignment prevented by compare-and-set on driver status or a single dispatcher per cell group
      - Region outage, fail over the region's state from a replica, degrade matching radius under load
references:
  - title: Uber engineering, H3, Uber's hexagonal hierarchical spatial index
    url: https://www.uber.com/blog/h3/
  - title: Uber engineering, How Uber's dispatch system works (Ringpop and DISCO talk summary)
    url: https://www.infoq.com/presentations/uber-realtime-market-platform/
updated: 2026-10-02
reviewed: true
---

## Requirements

Drivers continuously report their location and availability. A rider enters pickup and destination and gets matched with a nearby driver within seconds. Both parties see each other's position live until pickup; the trip proceeds through states until completion and payment. The system must be highly available per city, and a driver must never be assigned two trips at once.

## Estimates

One million online drivers reporting every 4 seconds is **250,000 location writes per second**, far more than any relational database should see on a hot path. Trips are tiny by comparison (tens of thousands per minute worldwide). Reads for matching (nearby lookups) and tracking (riders polling or subscribed to one driver) are in the millions per second but local to a region.

## API

Drivers hold a persistent connection: they stream `location { lat, lng, heading, status }` frames and receive `offer { tripId, pickup, eta, expiresAt }` frames to accept or decline. Riders call `POST /trips { pickup, destination }` and subscribe to trip updates; `GET /trips/{id}` returns the current state, driver position and ETA; `POST /trips/{id}/cancel`.

## Data model

Live state lives in memory, partitioned by region: `driver:{id} → { cell, lat, lng, status, updatedAt }` and `cell:{h3} → set(driverIds)`. Durable state in a database: `trips(id, rider_id, driver_id, state, pickup, dropoff, requested_at, matched_at, started_at, ended_at, fare)`. Raw location history is appended to a stream for analytics and dispute resolution, not written to the trip database.

## High-level design

```mermaid
flowchart LR
  D[Driver app] <--> GW[Gateway]
  R[Rider app] <--> GW
  GW --> LOC[Location service]
  LOC --> GEO[(In-memory geo index per region)]
  GW --> TRIP[Trip service] --> TDB[(Trips DB)]
  TRIP --> MATCH[Matching / dispatch]
  MATCH --> GEO
  MATCH --> ETA[Routing / ETA service]
  MATCH --> PRICE[Pricing]
  TRIP --> NOTIF[Push to clients]
  LOC --> LOG[(Location history stream)]
```

## Deep dives

**Geo index.** Convert each location to an H3 (or geohash) cell at a resolution around 0.5–1 km. Updating a driver means removing them from the old cell set and adding to the new one: two in-memory operations. Matching queries the pickup cell and its ring of neighbours, yielding tens of candidates, then computes exact distance and asks the routing service for ETAs.

**Dispatch.** Rank candidates by ETA (and acceptance history, fairness). Atomically set the best driver's status from `available` to `offered` (compare-and-set); if that fails, try the next. Send the offer with a 10–15 s expiry. On accept, transition the trip to `matched` and the driver to `on_trip`; on decline or timeout, release the driver and offer the next candidate. Every transition is idempotent and recorded.

**Trip state machine.** `requested → matching → matched → arriving → in_progress → completed | cancelled`. The trip service is the single writer for a trip; clients send intents, the service validates the transition.

**Regional sharding.** Matching is inherently local, so shard the live index, matching and gateways by city or region. Cross-region is only needed near borders; include neighbouring region cells in the query when the pickup is near an edge.

## Bottlenecks and failure modes

- **Location write volume:** in-memory, region-partitioned stores absorb it; sample to durable storage at a lower rate.
- **Double assignment:** the compare-and-set on driver status (or a single dispatcher process per cell group) is the invariant; say it explicitly.
- **Hot cells:** a stadium emptying creates thousands of requests in one cell; widen the search ring progressively and use surge pricing to rebalance supply.
- **Region failure:** replicate live state to a standby; on failover drivers reconnect and re-report location within seconds, so the index rebuilds itself.
- **ETA service slowness:** fall back to straight-line distance ranking rather than blocking matches.
