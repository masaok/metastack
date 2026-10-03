---
id: optimistic-vs-pessimistic-locking
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [concurrency, databases, consistency]
prompt: >
  Compare optimistic and pessimistic concurrency control. How would you protect
  seat booking versus editing a wiki page?
keyPoints:
  - Pessimistic locks the row (SELECT FOR UPDATE) before reading, so conflicts block rather than fail, best when contention is high
  - Optimistic reads a version, does work, and writes with a version check, retrying on mismatch, best when conflicts are rare
  - Pessimistic risks deadlocks and held locks across slow operations or user think time
  - Optimistic wastes work under high contention because many attempts fail and retry
  - Seat booking, pessimistic or an atomic conditional decrement, wiki editing, optimistic with version numbers and merge on conflict
eli5:
  - Lock the item before you look at it, so others wait their turn, which suits a crowd fighting over the same thing
  - Or take no lock, note the version you read, and save only if the version is unchanged, trying again if not, which suits rare clashes
  - Locking first can leave two parties stuck waiting on each other, or keep a lock held while someone thinks
  - Checking the version at the end throws away a lot of work when clashes are common
  - Lock up front for booking seats, and check versions for editing a shared page
distractors:
  - text: Optimistic locking takes a row lock before reading, so conflicts block
    why: That describes pessimistic locking. Optimistic takes no lock and checks a version when it writes
  - text: Pessimistic locking is best when conflicts are rare, since locks are cheap to hold
    why: When conflicts are rare the locks are pure overhead. Pessimistic pays off when contention is high
  - text: Optimistic concurrency can deadlock, because transactions wait on each other's version numbers
    why: Optimistic transactions never wait on each other, so they cannot deadlock. A conflict simply fails and retries
followUps:
  - How would you implement optimistic locking in a REST API using ETags?
  - What happens to a pessimistic lock if the application crashes mid-transaction?
references:
  - title: PostgreSQL docs, Explicit locking
    url: https://www.postgresql.org/docs/current/explicit-locking.html
  - title: MDN, HTTP conditional requests
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Conditional_requests
updated: 2026-10-02
reviewed: true
---

Two writers want the same record. You can stop one from starting (pessimistic) or let both proceed and reject the loser at commit (optimistic).

**Pessimistic locking.** Acquire a lock on the rows you intend to change, typically `SELECT ... FOR UPDATE` inside a transaction. Other writers block until you commit. Correctness is straightforward and no work is wasted, but locks held during slow operations (an external API call, or worse, while a user thinks) serialise everything behind them, and two transactions locking rows in different orders will deadlock. Keep lock scope tiny and never hold a database lock across user interaction.

**Optimistic locking.** Read the record and its `version`. Do your work without holding anything. Write with `UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?`. If zero rows were updated, someone else got there first; reload and retry or report the conflict. No locks, no deadlocks, and it works naturally across HTTP (ETag / `If-Match`). Under heavy contention, however, most attempts fail and the retry storm costs more than a lock would have.

**Seat booking.** Dozens of people hammer the same few seats in the seconds after sales open, so contention is extreme and a failed attempt is a bad user experience. Use pessimistic locking on the seat row, or better, a single atomic conditional write (`UPDATE seats SET status = 'held' WHERE id = ? AND status = 'free'`) and inspect the row count. Add a time-limited hold so abandoned carts release seats.

**Wiki editing.** Edits take minutes, conflicts are rare, and locking a page while someone reads it would be absurd. Use optimistic locking: the editor submits with the version it loaded, and on mismatch the server returns both versions for a merge.

Rule of thumb: high contention and short critical sections favour pessimistic; long operations and rare conflicts favour optimistic.
