---
id: bloom-filters
deck: fundamentals
type: concept
difficulty: 2
tags: [data-structures, caching, storage]
prompt: >
  What is a Bloom filter, what guarantees does it give, and where would you use
  one in a large system?
keyPoints:
  - A bit array with k hash functions that answers "definitely not present" or "probably present"
  - No false negatives, tunable false-positive rate set by bits per element and number of hashes
  - Standard Bloom filters cannot delete, counting Bloom filters or cuckoo filters can
  - Used to skip disk reads in LSM stores, avoid caching one-hit-wonders in CDNs, and check username or URL seen-before at scale
  - Size estimate, about 10 bits per element gives roughly 1% false positives
eli5:
  - A row of switches that several stamps flip on for each item, which can tell you definitely not here or possibly here
  - It never says no for something that was added, and more switches per item make wrong maybes rarer
  - The basic version cannot forget an item, though variants that count or store small tags can
  - It saves pointless disk lookups, stops caching things asked for only once, and checks whether a name or address was seen before
  - As a rule of thumb, ten switches per item gets about one wrong maybe in a hundred
distractors:
  - A Bloom filter can report an element as absent even though it was added
  - Deleting an element just clears its bits, which leaves every other element unaffected
  - The false-positive rate stays fixed however many elements are added to a filter of a given size
followUps:
  - How does RocksDB use Bloom filters per SSTable and what does it save?
  - How would you size a filter for 1 billion URLs at 0.1% false positives?
references:
  - title: Wikipedia, Bloom filter
    url: https://en.wikipedia.org/wiki/Bloom_filter
  - title: RocksDB wiki, RocksDB Bloom filter
    url: https://github.com/facebook/rocksdb/wiki/RocksDB-Bloom-Filter
updated: 2026-10-02
reviewed: true
---

A Bloom filter is a compact, probabilistic set. It cannot list its members and it is occasionally wrong in one direction, but it is tiny and answers membership in constant time.

**Mechanics.** Allocate *m* bits, all zero. To insert an item, compute *k* independent hashes and set those *k* bit positions to 1. To query, compute the same *k* positions: if any bit is 0 the item was never inserted; if all are 1 it was *probably* inserted, because other items may have set those bits.

**Guarantees.** Never a false negative. False positives at a rate you choose: with *n* items, *m* bits and optimal *k = (m/n) ln 2*, the rate is about *(0.6185)^(m/n)*. Ten bits per item gives roughly 1%; twenty bits gives about 0.01%. A billion URLs at 1% is about 1.2 GB, which fits in RAM where the URLs themselves (tens of gigabytes) would not.

**Limitations.** You cannot remove an item, since clearing a bit might remove someone else's evidence. Counting Bloom filters keep small counters per position; cuckoo filters support deletion with similar space.

**Where they live**

- **LSM-tree storage engines** (RocksDB, Cassandra, HBase) keep a filter per SSTable. A point read checks the filter before touching disk and skips files that cannot contain the key, turning a read that might touch ten files into one or two.
- **CDN cache admission.** Only cache an object on its *second* request by remembering first requests in a Bloom filter, which keeps one-hit-wonders from evicting popular content.
- **Web crawlers** track seen URLs; **browsers** (historically) checked malicious URL lists; **databases** avoid unnecessary joins; **recommendation systems** filter already-shown items.

Give the two-outcome answer ("no" is certain, "yes" is probable), the sizing rule of thumb, and one concrete use.
