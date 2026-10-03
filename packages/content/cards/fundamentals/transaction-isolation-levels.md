---
id: transaction-isolation-levels
deck: fundamentals
type: concept
difficulty: 3
tags: [databases, consistency, concurrency]
prompt: >
  Explain the SQL isolation levels and the anomalies each prevents. Which level
  do production databases default to, and why?
keyPoints:
  - Read uncommitted allows dirty reads, read committed prevents them but allows non-repeatable reads
  - Repeatable read (snapshot isolation in practice) gives a consistent snapshot but can allow write skew and phantoms
  - Serializable makes transactions behave as if run one at a time, preventing write skew at the cost of aborts or locking
  - Postgres and Oracle default to read committed, MySQL InnoDB to repeatable read
  - Write skew example, two doctors both checking "at least one on call" and both going off call
eli5:
  - The weakest level lets you see changes others have not finished, and the next hides those but a value can still change between two looks
  - The next level gives you a frozen picture for your whole transaction, yet two transactions can still each make a choice that is wrong when combined
  - The strongest level acts as though transactions ran one after another, at the price of waiting or being told to retry
  - Popular databases differ in which level they use unless told otherwise
  - The classic trap is two doctors who each see the other is on call and both sign off, leaving nobody
distractors:
  - text: Read committed prevents non-repeatable reads
    why: At read committed a second read can see another transaction's newly committed change. Repeatable read prevents that
  - text: Snapshot isolation prevents write skew
    why: Two transactions can each read the same snapshot and write different rows, breaking a rule neither one sees broken
  - text: Most production databases default to serializable
    why: Postgres and Oracle default to read committed, and MySQL InnoDB to repeatable read. Serializable is opt-in
followUps:
  - How does MVCC implement snapshot isolation without blocking readers?
  - When would you use SELECT ... FOR UPDATE instead of raising the isolation level?
references:
  - title: PostgreSQL docs, Transaction isolation
    url: https://www.postgresql.org/docs/current/transaction-iso.html
  - title: Berenson et al., A critique of ANSI SQL isolation levels (SIGMOD 1995)
    url: https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/
updated: 2026-10-02
reviewed: true
---

Isolation describes how much one running transaction can see of another. Weaker levels are faster and allow more concurrency; stronger levels prevent more anomalies.

**Anomalies**

- **Dirty read:** reading data another transaction has written but not committed.
- **Non-repeatable read:** reading the same row twice in one transaction and getting different values because someone committed in between.
- **Phantom read:** re-running a query and seeing new rows that match the predicate.
- **Lost update:** two transactions read-modify-write the same row and one overwrites the other.
- **Write skew:** two transactions read overlapping data, make decisions, and write to *different* rows such that the combination violates an invariant. Classic example: two on-call doctors each see that two people are on call and both go off, leaving zero.

**Levels**

| Level | Dirty | Non-repeatable | Phantom | Write skew |
| --- | --- | --- | --- | --- |
| Read uncommitted | allowed | allowed | allowed | allowed |
| Read committed | prevented | allowed | allowed | allowed |
| Repeatable read / snapshot | prevented | prevented | mostly prevented | allowed |
| Serializable | prevented | prevented | prevented | prevented |

Most engines implement repeatable read as **snapshot isolation** via MVCC: each transaction sees the database as of its start, readers never block writers, and the first committer wins on a conflicting row. Snapshot isolation stops lost updates on the same row but not write skew across rows.

**Defaults.** PostgreSQL, Oracle and SQL Server default to read committed because it rarely aborts and performs well; MySQL InnoDB defaults to repeatable read. Serializable (Postgres uses serializable snapshot isolation, SSI) is available when invariants span rows, at the cost of occasional serialization-failure retries.

**In practice** you keep the default and protect specific invariants explicitly: `SELECT ... FOR UPDATE` to lock the rows you will decide on, unique constraints for "only one of X", or optimistic version checks on update.
