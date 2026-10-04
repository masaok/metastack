# Blog keyword map

One keyword, one post. The content check (`pnpm check:blog`) reads this table: every `Keyword` row must be the `primaryKeyword` of exactly one post, and every post's primary keyword must appear here. The row's `Category` must match the post's.

The first fifteen rows were derived from the project or from an earlier supplied list. The fifty rows added on 2026-10-03 come from a supplied interview-keyword list. One other supplied file was empty and contributed nothing. No volume, difficulty or ranking numbers are claimed.

Eight categories. That is one cluster per unused subject on the list that still belongs on a system-design blog (study method, data, traffic, worked designs, caches, architecture, consensus, ops). Language-specific, LeetCode-pattern, behavioral and company-loop keywords stay off this map: they are not what the cards teach.

| Keyword                             | Intent  | Category                   | Post title                                             | Slug                                  | Status    |
| ----------------------------------- | ------- | -------------------------- | ------------------------------------------------------ | ------------------------------------- | --------- |
| system design interview flashcards  | do      | study-method               | System design interview flashcards that actually stick | `system-design-interview-flashcards`  | published |
| spaced repetition for system design | learn   | study-method               | Spaced repetition for system design: why it works      | `spaced-repetition-for-system-design` | published |
| fsrs vs sm-2                        | compare | study-method               | FSRS vs SM-2: which scheduler should you study with?   | `fsrs-vs-sm-2`                        | published |
| back-of-the-envelope estimation     | do      | worked-designs             | Back-of-the-envelope estimation for system design      | `back-of-the-envelope-estimation`     | published |
| consistent hashing explained        | learn   | data-and-consistency       | Consistent hashing explained for the interview         | `consistent-hashing-explained`        | published |
| cap theorem                         | learn   | data-and-consistency       | CAP theorem explained for interviews                   | `cap-theorem-explained`               | published |
| pacelc                              | learn   | data-and-consistency       | PACELC explained for system design                     | `pacelc-explained`                    | published |
| rate limiting                       | learn   | traffic-and-reliability    | Rate limiting for system design interviews             | `rate-limiting-for-interviews`        | published |
| load balancing                      | learn   | traffic-and-reliability    | Load balancing for system design interviews            | `load-balancing-for-interviews`       | published |
| database partitioning               | learn   | data-and-consistency       | Database partitioning explained simply                 | `database-partitioning-explained`     | published |
| message queues                      | learn   | traffic-and-reliability    | Message queues for system design interviews            | `message-queues-for-interviews`       | published |
| design url shortener                | do      | worked-designs             | Design URL shortener for the interview                 | `design-url-shortener`                | published |
| design news feed                    | do      | worked-designs             | Design news feed for the interview                     | `design-news-feed`                    | published |
| idempotency                         | learn   | traffic-and-reliability    | Idempotency keys in system design                      | `idempotency-keys`                    | published |
| sql                                 | compare | data-and-consistency       | SQL vs NoSQL for system design interviews              | `sql-vs-nosql`                        | published |
| system design interview             | do      | study-method               | System design interview: what to drill first           | `system-design-interview`             | published |
| system design preparation           | do      | study-method               | System design preparation that fits in a month         | `system-design-preparation`           | published |
| system design mock interview        | do      | study-method               | System design mock interview, run at home              | `system-design-mock-interview`        | published |
| interview study guide               | do      | study-method               | Interview study guide for system design                | `interview-study-guide`               | published |
| software interview study plan       | do      | study-method               | A software interview study plan by topic               | `software-interview-study-plan`       | published |
| database indexing                   | learn   | data-and-consistency       | Database indexing for system design interviews         | `database-indexing`                   | published |
| database replication                | learn   | data-and-consistency       | Database replication for system design interviews      | `database-replication`                | published |
| quorum                              | learn   | data-and-consistency       | Quorum reads and writes in system design               | `quorum`                              | published |
| circuit breaker                     | learn   | traffic-and-reliability    | Circuit breaker pattern for interviews                 | `circuit-breaker`                     | published |
| backpressure                        | learn   | traffic-and-reliability    | Backpressure in system design interviews               | `backpressure`                        | published |
| api gateway                         | learn   | traffic-and-reliability    | API gateway for system design interviews               | `api-gateway`                         | published |
| reverse proxy                       | learn   | traffic-and-reliability    | Reverse proxy for system design interviews             | `reverse-proxy`                       | published |
| design chat system                  | do      | worked-designs             | Design chat system for the interview                   | `design-chat-system`                  | published |
| design distributed cache            | do      | worked-designs             | Design distributed cache for the interview             | `design-distributed-cache`            | published |
| design web crawler                  | do      | worked-designs             | Design web crawler for the interview                   | `design-web-crawler`                  | published |
| design notification system          | do      | worked-designs             | Design notification system for interviews              | `design-notification-system`          | published |
| design payment system               | do      | worked-designs             | Design payment system for the interview                | `design-payment-system`               | published |
| design search engine                | do      | worked-designs             | Design search engine for the interview                 | `design-search-engine`                | published |
| caching                             | learn   | caching-and-storage        | Caching for system design interviews                   | `caching`                             | published |
| cdn                                 | learn   | caching-and-storage        | CDN for system design interviews                       | `cdn`                                 | published |
| blob storage                        | learn   | caching-and-storage        | Blob storage for system design interviews              | `blob-storage`                        | published |
| redis                               | learn   | caching-and-storage        | Redis for system design interviews                     | `redis`                               | published |
| lru cache                           | learn   | caching-and-storage        | LRU cache for system design interviews                 | `lru-cache`                           | published |
| time series databases               | learn   | caching-and-storage        | Time series databases for interviews                   | `time-series-databases`               | published |
| graph databases                     | learn   | caching-and-storage        | Graph databases for system design interviews           | `graph-databases`                     | published |
| elasticsearch                       | learn   | caching-and-storage        | Elasticsearch for system design interviews             | `elasticsearch`                       | published |
| microservices                       | compare | architecture               | Microservices vs a monolith in interviews              | `microservices`                       | published |
| event driven architecture           | learn   | architecture               | Event driven architecture for interviews               | `event-driven-architecture`           | published |
| cqrs                                | learn   | architecture               | CQRS and event sourcing for interviews                 | `cqrs`                                | published |
| sagas                               | learn   | architecture               | Sagas for distributed transactions, explained          | `sagas`                               | published |
| stream processing                   | learn   | architecture               | Stream processing for system design interviews         | `stream-processing`                   | published |
| api design                          | do      | architecture               | API design for system design interviews                | `api-design`                          | published |
| clean architecture                  | learn   | architecture               | Clean architecture for system design interviews        | `clean-architecture`                  | published |
| stateless services                  | learn   | architecture               | Stateless services for system design interviews        | `stateless-services`                  | published |
| raft                                | learn   | consensus-and-coordination | Raft consensus for system design interviews            | `raft`                                | published |
| leader election                     | learn   | consensus-and-coordination | Leader election for system design interviews           | `leader-election`                     | published |
| two phase commit                    | learn   | consensus-and-coordination | Two phase commit for system design interviews          | `two-phase-commit`                    | published |
| distributed locks                   | learn   | consensus-and-coordination | Distributed locks for system design interviews         | `distributed-locks`                   | published |
| distributed transactions            | learn   | consensus-and-coordination | Distributed transactions for interviews                | `distributed-transactions`            | published |
| consensus                           | learn   | consensus-and-coordination | Consensus in system design interviews                  | `consensus`                           | published |
| availability                        | learn   | consensus-and-coordination | Availability in system design interviews               | `availability`                        | published |
| fault tolerance                     | learn   | consensus-and-coordination | Fault tolerance for system design interviews           | `fault-tolerance`                     | published |
| capacity planning                   | do      | observability-and-ops      | Capacity planning for system design interviews         | `capacity-planning`                   | published |
| observability                       | learn   | observability-and-ops      | Observability for system design interviews             | `observability`                       | published |
| tracing                             | learn   | observability-and-ops      | Tracing in system design interviews                    | `tracing`                             | published |
| slo                                 | learn   | observability-and-ops      | SLO design for system design interviews                | `slo`                                 | published |
| horizontal scaling                  | learn   | observability-and-ops      | Horizontal scaling for system design interviews        | `horizontal-scaling`                  | published |
| design metrics system               | do      | observability-and-ops      | Design metrics system for the interview                | `design-metrics-system`               | published |
| design logging system               | do      | observability-and-ops      | Design logging system for the interview                | `design-logging-system`               | published |
| design job scheduler                | do      | observability-and-ops      | Design job scheduler for the interview                 | `design-job-scheduler`                | published |

## Rules the table encodes

- `Keyword` is lowercase and is matched case-insensitively in the post's title, description and first paragraph, and hyphenated in the slug.
- `Intent` is one of `learn`, `compare`, `do`, `buy`.
- `Category` is a slug from `CATEGORIES` in `apps/web/src/lib/blog/schema.ts` and equals the post's `category`. Choose it here, with the keyword, before the post is written.
- `Slug` is the file name under `apps/web/content/blog/` and the path under `/blog/`.
- `Status` is `planned` until the post file exists with `draft: false`, then `published`.

## Grouped or deferred

Grouped onto one post, because they ask the same question:

- `cap theorem` also carries `consistency`, `eventual consistency`, and `strong consistency`.
- `rate limiting` also carries `design rate limiter`.
- `database partitioning` also carries `sharding` and `partitioning`.
- `message queues` also carries `pub sub`.
- `idempotency` also carries `idempotency keys`.
- `sql` also carries `nosql`, `relational databases`, `document databases`, and `key value stores`.
- `microservices` also carries `monolith` and `service oriented architecture`.
- `cqrs` also carries `event sourcing`.
- `blob storage` also carries `object storage`.
- `raft` also carries `paxos` as a comparison, not a second post.
- `slo` also carries `sli` and `sla`.
- `horizontal scaling` also carries `vertical scaling`.
- `stateless services` also carries `stateful services`.
- `design chat system` also carries `design WhatsApp` and `design Slack`.
- `design search engine` also carries `design autocomplete` as a follow-up, not a second post.
- `database replication` also carries `read replicas` at a high level; lag detail stays in this post.
- `caching` also carries cache-aside as the default pattern; write strategies and eviction are neighbouring posts.
- `interview study guide` also carries `interview cheat sheet` and `interview roadmap`.
- `software interview study plan` also carries `coding interview preparation` only as a contrast: this site drills design, not DSA.

`pacelc` stays its own post. It is the question you answer when the network is healthy, which CAP does not cover.

Left off this run, because they are a different product than MetaStack: LeetCode patterns, language interviews (React, Java, SQL joins as interview trivia), behavioral loops, company-specific loops (Google L4, Amazon), and Git/DevOps tool catalogs.

## Section plan

Each new post owns the headings listed. Do not reuse an h2 from another post, including the fifteen already published. Link to a neighbouring post instead of restating it.

### system-design-interview

Answers: What should you actually do in a system design interview?

- What the interviewer is scoring
- A 45-minute clock you can reuse
- What to clarify before you draw
- When to estimate, and how little is enough
- How the MetaStack cards map onto the hour

### system-design-preparation

Answers: How do you prepare for system design without rereading a book?

- A four-week calendar that fits a job
- What to drill in week one
- What to drill once the cards start repeating
- A weekend mock that uses the same rubric
- When you are ready to stop adding cards

### system-design-mock-interview

Answers: How do you run a system design mock interview alone?

- A mock you can run without a partner
- The prompt, the timer, and the recording
- Grading the recording against key points
- What a weak mock usually missed
- Turning one mock into the next week's cards

### interview-study-guide

Answers: What belongs on a system design interview study guide?

- The topics that show up in almost every loop
- The topics that can wait
- A one-page guide versus a deck
- How to keep the guide honest as you learn
- Linking the guide to a daily review

### software-interview-study-plan

Answers: How should a software interview study plan split coding and design?

- Why a single plan usually starves design
- Hours for coding, hours for design
- A plan for a two-week notice
- A plan for a three-month search
- What MetaStack covers and what it does not

### database-indexing

Answers: What does an interviewer want to hear about database indexing?

- What an index is for, in one sentence
- B-tree versus hash, and when each wins
- Composite order and the query that misses
- The write cost you must say out loud
- Covering indexes and the ones you skip

### database-replication

Answers: How do you explain database replication on a whiteboard?

- Why a second copy exists
- Synchronous versus asynchronous replicas
- What a reader is allowed to see
- Failover that does not split the brain
- Lag you can estimate, and lag you cannot

### quorum

Answers: What is a quorum, and when do you use one?

- The inequality that makes a quorum safe
- Read and write quorums that overlap
- Sloppy quorums and hinted handoff
- What you give up for the extra availability
- A store that uses quorums, drawn small

### circuit-breaker

Answers: When do you put a circuit breaker on a call?

- Closed, open, and half-open
- What trips the breaker, and what does not
- Fallback that is honest
- Breakers versus retries and timeouts
- Where the breaker lives in a service mesh

### backpressure

Answers: How does backpressure keep a pipeline from falling over?

- Slow consumer, fast producer
- Bounded queues and what they refuse
- Drop, sample, or block
- Backpressure across a network hop
- A metrics pipeline that applies it

### api-gateway

Answers: What belongs in an API gateway, and what does not?

- The jobs a gateway is good at
- Auth, routing, and fan-out
- What you must not hide behind the gateway
- Gateway versus a reverse proxy and a mesh
- A chat or feed design that needs one

### reverse-proxy

Answers: What does a reverse proxy do that a load balancer does not?

- TLS, buffering, and the origin
- Caching at the proxy
- Path routing versus connection routing
- Where nginx or an equivalent sits in a drawing
- Mistakes that turn the proxy into a bottleneck

### design-chat-system

Answers: How do you design a chat system in an interview?

- Connections that stay open
- The path of one 1:1 message
- Group fan-out and the size that breaks it
- History, receipts, and presence
- What the chat-system card already asks you to say

### design-distributed-cache

Answers: How do you design a distributed cache in an interview?

- What the cache guarantees, and what it does not
- Placement, eviction, and replication
- A stampede and a stale write
- Hot keys and the node that melts
- What the distributed-cache card already asks you to say

### design-web-crawler

Answers: How do you design a web crawler in an interview?

- Frontier, politeness, and the URL seen-set
- Fetch, parse, and enqueue
- Freshness versus coverage
- The bloom filter on the seen-set
- What the web-crawler card already asks you to say

### design-notification-system

Answers: How do you design a notification system in an interview?

- The event, the preference, and the channel
- Fan-out that cannot wake a million phones at once
- Dedup, quiet hours, and retries
- Push, email, and SMS as separate workers
- What the notification-system card already asks you to say

### design-payment-system

Answers: How do you design a payment system in an interview?

- The ledger is the source of truth
- Idempotent charges and the provider boundary
- Capture, refund, and a double charge
- What you store, and what the provider keeps
- What the payment-system card already asks you to say

### design-search-engine

Answers: How do you design a search engine in an interview?

- Crawl, index, and query as three systems
- The inverted index and what a document costs
- Ranking that is allowed to be eventually consistent
- Typeahead as a smaller, hotter index
- What the search-indexing card already asks you to say

### caching

Answers: What should you say when an interviewer asks about caching?

- What a cache is allowed to get wrong
- Aside, through, and behind in one table
- Where a cache sits in a typical drawing
- Invalidation you can actually run
- The MetaStack cache cards, in the order to drill them

### cdn

Answers: What does a CDN change in a system design?

- Edge versus origin
- What you may cache, and for how long
- Push versus pull, in brief
- A hot video or a hot short link
- What the cdn-basics card already asks you to say

### blob-storage

Answers: When do you put bytes in blob storage instead of a database?

- The object, the key, and the metadata
- A photo or a video that must not live in rows
- Consistency of the object versus the pointer
- Lifecycle, CDN, and the database row that points at it
- What the blob-storage-vs-database card already asks you to say

### redis

Answers: What is Redis for in a system design interview?

- The structures interviewers expect you to name
- Cache, lock, and stream as three different jobs
- Persistence you should not pretend is a database
- Clustered Redis and the slot that moves
- When to pick something else

### lru-cache

Answers: How does an LRU cache work, and when is it the wrong policy?

- The map and the list
- A get and a put in constant time
- Scan resistance
- LFU and TTL as the alternatives
- What the cache-eviction card already asks you to say

### time-series-databases

Answers: When do you need a time series database?

- Append-heavy writes and rollups
- The query that is a range, not a join
- Downsampling and retention
- Metrics versus events
- Why a general store starts to hurt

### graph-databases

Answers: When is a graph database the right store?

- Neighbour queries that explode in SQL
- Social, fraud, and access paths
- What you give up at write time
- A property graph versus a triple store, briefly
- When a relational recursive query is enough

### elasticsearch

Answers: What is Elasticsearch for in a system design?

- The inverted index you already drew
- Relevance versus exact match
- Near-real-time, not transactional
- How it sits next to the source of truth
- Failure modes interviewers like

### microservices

Answers: When do you split a monolith into microservices?

- Independent deploys and the cost that comes with them
- Split on a business capability, not a layer
- The modular monolith in the middle
- A workflow that used to be one transaction
- What the microservices-vs-monolith card already asks you to say

### event-driven-architecture

Answers: What does event driven architecture change?

- A fact that already happened
- Consumers you can add without a meeting
- Ordering, duplicates, and the log
- When a request-response call is clearer
- A feed or a notification path that is event-driven

### cqrs

Answers: When does CQRS help, and when is it costume jewelry?

- Separate models for write and read
- Event sourcing as an optional store for the write side
- The lag the read model is allowed
- A news feed or a bookings read model
- What the cqrs-and-event-sourcing card already asks you to say

### sagas

Answers: How do sagas finish a workflow that spans services?

- Choreography versus orchestration
- Compensating steps that actually run
- What a saga is not (a two-phase commit)
- A payment-plus-inventory example
- Failure you can still explain on a whiteboard

### stream-processing

Answers: What is stream processing for in an interview?

- Event time versus processing time
- Windows, watermarks, and late data
- A join that cannot wait for the batch
- Stream versus a queue you drain
- A fraud or metrics job that needs it

### api-design

Answers: How do you design an API in a system design interview?

- Resources, verbs, and the error body
- Pagination, filtering, and idempotent writes
- Versioning that does not trap you
- What belongs in the query, the header, and the body
- A shortener or a feed API you can write in five minutes

### clean-architecture

Answers: What does clean architecture mean when you are designing a service?

- Dependencies that point inward
- Domain, use case, and adapter
- Why interviewers rarely want the full diagram
- A payment service cut this way
- When a simpler package layout is enough

### stateless-services

Answers: Why do interviewers push stateless services?

- What "stateless" actually excludes
- Session, upload, and the store that holds them
- Scaling out without sticky routing
- When a stateful service is the honest answer
- Drawing the boundary on a chat or a feed

### raft

Answers: What does Raft give you that a primary-replica pair does not?

- Leader, log, and majority
- An election after the leader dies
- Why Paxos is the same idea with a harder story
- What Raft does not give you
- A metadata store that needs it

### leader-election

Answers: How do you elect a leader in a distributed system?

- Why only one writer may exist
- Leases, fencing, and a dead leader
- Election versus Raft's election
- Split brain you can draw
- What the leader-follower card already asks you to say

### two-phase-commit

Answers: How does two phase commit work, and why do people avoid it?

- Prepare and commit
- The coordinator that must not vanish
- Blocking, and the timeout that does not save you
- When a saga is the better story
- A cross-shard write that still wants it

### distributed-locks

Answers: How do you take a distributed lock without lying to yourself?

- The lock, the fencing token, and expiry
- Redis locks and the cases they miss
- ZooKeeper or etcd as the slower honest option
- Work that must not run twice
- What you should not use a lock for

### distributed-transactions

Answers: How do you talk about distributed transactions in an interview?

- Why one BEGIN is gone
- Outbox, saga, and 2PC as three tools
- The invariant you are actually protecting
- A charge that must match a ledger row
- What to pick when the interviewer pushes

### consensus

Answers: What does consensus mean in a system design interview?

- Agreement, validity, and termination, in plain words
- Why a majority is the usual trick
- Consensus versus gossip and versus a quorum read
- Where it belongs in a drawing (small)
- Linking to Raft when they want the algorithm

### availability

Answers: How do you talk about availability without a fake number?

- What a nine means, and what it hides
- Planned work versus unplanned
- Redundancy that actually fails independently
- The user-visible error budget
- Tying availability to an SLO

### fault-tolerance

Answers: What makes a design fault tolerant?

- The fault you name first
- Retry, timeout, and isolation
- Bulkheads and the noisy neighbour
- Degradation that is still a product
- A store or a queue that can lose a node

### capacity-planning

Answers: How do you do capacity planning in an interview?

- QPS, storage, and the machine count
- Peak versus average
- Headroom you can defend
- What the estimation cards already force you to compute
- A plan that changes when the read ratio moves

### observability

Answers: What is observability in a system design?

- Logs, metrics, and traces as three signals
- The question each signal answers
- Cardinality that blows up a metrics bill
- What you add when you draw a new service
- Linking to the metrics and tracing posts

### tracing

Answers: How does tracing help in a distributed design?

- A trace id that follows the request
- Spans, sampling, and the tail
- What traces are bad at
- A chat or payment path with three spans
- OpenTelemetry as the vocabulary, not a vendor pitch

### slo

Answers: How do you set an SLO an interviewer will accept?

- SLI, SLO, and SLA in one pass
- A latency SLO with a good and a bad window
- Error budgets that change the week's work
- What not to put in an SLO
- A feed or a redirect that needs one

### horizontal-scaling

Answers: How do you scale horizontally, and when do you not?

- Adding clones behind a balancer
- The data that refuses to clone
- Vertical scaling as the first move
- Shard, then clone the stateless tier
- A drawing that shows both

### design-metrics-system

Answers: How do you design a metrics system in an interview?

- Emit, transport, store, query
- Cardinality and aggregation
- Pull versus push
- Alerting that is not the same system
- What the metrics-monitoring card already asks you to say

### design-logging-system

Answers: How do you design a logging system in an interview?

- Agents, a buffer, and a store you can search
- Structured lines and a trace id
- Retention versus a metrics rollup
- A spike that must not take down the product
- How this differs from the metrics design

### design-job-scheduler

Answers: How do you design a job scheduler in an interview?

- The job, the schedule, and the worker
- Exactly-once you will not get
- Catch-up after a missed window
- Priorities and a stuck worker
- A crawl or a digest that uses it
