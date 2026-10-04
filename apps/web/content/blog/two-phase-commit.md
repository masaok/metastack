---
slug: two-phase-commit
title: Two phase commit for system design interviews
description: Two phase commit for system design interviews. Prepare and commit, why the coordinator cannot vanish, and when a saga is the better story.
primaryKeyword: two phase commit
secondaryKeywords:
  - 2pc
  - sagas
  - atomic commit
category: consensus-and-coordination
tags:
  - consistency
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the two phase commit answer an interviewer wants. Two stores must accept one write or neither store may keep it. A coordinator asks each participant to prepare. Each participant that votes yes persists that vote and waits. If every vote is yes, the coordinator persists a commit and tells them to finish. If any vote is no, it tells them to abort. The coordinator must not vanish at the wrong moment. A timeout does not let a participant that already voted yes invent a new decision. A saga is often the better story. A transfer across shards is the case that still wants the atomic pair. The rest of this post is those five claims.

## Prepare and commit

Call the two stores participants. Call the node that drives them the coordinator. The write is "debit account A by 30 and credit account B by 30." A and B live in different databases, or on different shards that do not share a transaction.

Phase one is prepare. The coordinator writes its own intent. It then asks A to prepare the debit and B to prepare the credit. Prepare means the participant checks that it can do the work, persists enough state to finish or undo, and answers yes or no. A yes is a promise. The participant will not use those resources for something else. It will not forget the promise if it restarts. A no is final for this attempt. The coordinator will abort.

Phase two is commit or abort. If both answers were yes, the coordinator persists `commit` and tells A and B to apply. Each participant applies, releases the held resources, and acknowledges. If either answer was no, or if prepare never came back in time before any yes was recorded as the group decision, the coordinator persists `abort` and tells everyone to drop the work.

The durable points are what make it an atomic commit. The participant that voted yes must be able to recover into the same promise. The coordinator that decided commit must be able to recover into the same decision. Memory is not enough. A restart in the middle is the case the protocol is for.

A single database transaction is not this protocol. One engine, one log, one commit record. Two phase commit starts when that log is no longer shared. Say that. Do not draw 2PC inside one Postgres. Draw it across two participants that cannot see each other's rows.

The yes vote is also a lock. A prepared debit has reserved the 30. Other debits that would overdraw must wait or fail. That is why people dislike the protocol in the same breath they describe it. The reservation lasts until phase two. Phase two can be delayed by a crash you do not control.

## The coordinator that must not vanish

The dangerous moment is after both participants have voted yes and before they have been told the decision. Each participant is blocked. It cannot abort, because the other side may already have been told to commit. It cannot commit, because the coordinator may still abort if the other vote failed. It waits. The coordinator is the only node that knows, or that is allowed to decide, the outcome.

If the coordinator vanishes after writing `commit` to its own log, a replacement can read that log and finish the tells. Participants that never heard the tell stay prepared until the replacement speaks. The protocol survives that crash. The coordinator was restartable.

If the coordinator vanishes before writing any decision, and nobody else can find a decision record, the participants stay prepared. A new coordinator can collect the votes again, or it can decide abort only if it knows no commit record exists. Designs differ on how a new coordinator is chosen. They do not differ on the rule. You must not decide commit on one path and abort on another for the same attempt.

This is why the coordinator is a single point of blocking, even when it is not a single point of data loss. High availability for the coordinator means a replicated log of decisions, not a hope that one process stays up. People then notice they have introduced consensus in order to commit across two stores. That observation is fair. It is also why many teams pick another tool when the invariant can be relaxed.

Do not hide the coordinator behind a library name and move on. Name the process. Name the log it writes. Name who takes over if it dies. An answer that says "the transaction manager handles it" has not answered the vanish case.

## Blocking, and the timeout that does not save you

Blocking is the usual reason to avoid two phase commit. A participant that voted yes holds locks. Other work on those rows waits. If the coordinator is slow, or partitioned, those locks sit. The rest of the shard waits on a decision that is not local. A hot account can stall a lot of traffic from one in-flight commit.

A timeout on the client does not undo a yes. The client stopped waiting. The participant did not. The 30 is still reserved. A timeout on the participant after it voted yes does not let it abort on its own. The other participant may have committed. Aborting now would break the atomic pair. The only legal move is to ask the coordinator, or a recovery record, what was decided. If nobody can say, the participant keeps waiting.

A timeout before the yes is different. The participant has not promised. It can answer no, or it can ignore a late prepare. The coordinator then aborts. That timeout is safe. The unsafe timeout is the one people reach for after they have already promised.

Retries need a name for the attempt. If the coordinator sends prepare twice, the participant must recognise the same work. If it treats the second prepare as a new debit, you reserved 60. An idempotency key on the attempt is how you keep one reservation. [Idempotency keys in system design](/blog/idempotency-keys) is that row. Two phase commit does not replace it. The protocol decides yes or no. The key decides which yes you meant.

What you say about failure.

1. A yes is durable and blocking.
2. After a yes, a local timeout cannot invent abort.
3. After a commit record, recovery must finish commit, not start over.
4. After no commit record, recovery must not invent commit on one side only.
5. The client timeout is not a decision.

## When a saga is the better story

A saga is a sequence of local transactions with a compensating action for each step that already succeeded. You debit A in one commit. You credit B in another. If the credit fails, you run a compensation that puts the 30 back on A. Each step is visible. The system is not atomic. It is reconcilable.

That is the better story when the business can stand a window where A is down and B is not yet up, and when you can write a compensation that is safe to retry. Orders, bookings with a later cancel, and emails are in this family. Money that must never show two different totals to two ledgers at the same time may not be.

The compensation is not an undo log. It is a new write. A refund is not a time machine. Another debit may have landed on A in the meantime. The compensation has to be written for that world. It also has to be idempotent. A crash after the refund but before you record that you refunded will retry. The retry must not refund twice.

Say why you picked the saga. You did not pick it because two phase commit is old. You picked it because you can name the intermediate state and the compensation. If you cannot name them, you do not have a saga. You have a hope that the second write always works.

A saga still needs a coordinator of sorts, or an orchestrated sequence, or a choreography of events. That coordinator can vanish too. The difference is that each step has already committed locally. Recovery replays the next step or the compensation. It does not hold prepared locks across stores while it thinks.

Use this contrast in the room. Two phase commit keeps one atomic outcome and pays with blocking and a delicate coordinator. A saga keeps local commits and pays with intermediate states and compensations. Pick from the invariant, not from fashion.

## A cross-shard write that still wants it

[Database partitioning explained simply](/blog/database-partitioning-explained) is how rows land on different machines. A shard key that puts account A on shard 1 and account B on shard 2 makes a transfer a write that no single local transaction can see. The cluster can hold more rows. It cannot treat those two rows as one engine.

This is the case that still wants two phase commit, or a protocol with the same promises. The invariant is that the 30 leaves A if and only if it arrives on B. A window where it has left A and not arrived on B is a missing 30. A window where it has arrived on B and not left A is a created 30. Some products can explain that window to a user. A ledger that must balance cannot.

A worked transfer.

```text
attempt: txn_904
coordinator log: started
shard 1 prepare: debit A 30, vote yes, hold 30
shard 2 prepare: credit B 30, vote yes, hold the credit
coordinator log: commit
shard 1: apply debit, release hold
shard 2: apply credit, release hold
```

If shard 2 votes no, because B is closed, the coordinator logs abort. Shard 1 releases the hold. No money moved. If the coordinator dies after `commit` and before the tells, recovery reads `commit` and finishes both applies. If you skip prepare and issue two local commits, a crash between them leaves the missing 30.

You can avoid the protocol by avoiding the cross-shard write. Put both accounts on the same shard when they always transfer as a pair. That is a shard-key choice. It is a good choice when the pair is stable. It is a bad choice when any account can transfer to any other account. Then the cross-shard write is the product.

What you say in the room.

1. Two phase commit is prepare, then commit or abort, with durable votes.
2. A yes holds resources. The coordinator's decision record is the unblocking event.
3. A timeout after yes does not grant a local abort.
4. A saga is better when you can name the intermediate state and a safe compensation.
5. A transfer across shards still wants one outcome for both sides.
6. Changing the shard key so both rows are local is a way to not need the protocol.

Practice the transfer on the board until the holds and the decision record are the first things you draw. Start on the [fundamentals study page](/study/fundamentals).
