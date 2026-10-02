---
id: geospatial-indexing
deck: fundamentals
type: concept
difficulty: 2
tags: [geo, indexing, data-structures]
prompt: >
  How do you efficiently find all drivers within 2 km of a rider? Compare
  geohash, quadtree and S2/H3 cell approaches.
keyPoints:
  - A naive bounding-box query on lat/long columns cannot use a single B-tree efficiently at scale
  - Geohash encodes a location as a string whose prefix identifies a grid cell, so nearby points share prefixes and can be indexed with ordinary string indexes
  - Quadtrees subdivide space adaptively so dense areas get smaller cells, good for in-memory indexes
  - S2 and H3 cover the sphere with hierarchical cells with uniform area and good neighbour properties, avoiding geohash edge effects
  - Search by computing the covering cells for the radius, querying them, then filtering by exact distance
followUps:
  - Why can two points very close together have completely different geohashes, and how do you handle it?
  - How would you keep this index updated when drivers move every few seconds?
references:
  - title: Uber engineering, H3, Uber's hexagonal hierarchical spatial index
    url: https://www.uber.com/blog/h3/
  - title: Redis docs, GEOSEARCH
    url: https://redis.io/docs/latest/commands/geosearch/
updated: 2026-10-02
reviewed: true
---

"Nearby" queries are range queries in two dimensions, and a B-tree only orders one. Spatial indexing maps 2D space onto a 1D key that keeps nearby points close.

**Geohash.** Interleave the bits of latitude and longitude and base-32 encode them. Each extra character divides the cell into 32 smaller cells, so `9q8yy` is a ~5 km cell and `9q8yyk` is ~1 km inside it. Points in the same cell share a prefix, so a plain string index (or a Redis sorted set, which is how `GEOSEARCH` works) can answer "everything in this cell" with a prefix range scan. Weakness: cells are rectangles that vary in size with latitude, and two points on either side of a cell boundary share no prefix, so you must also query the eight neighbouring cells.

**Quadtree.** Recursively split a square into four until each leaf holds fewer than N points. Dense cities get deep, small cells; oceans stay as one big cell. Excellent for in-memory indexes that must adapt to skewed data; harder to distribute and persist than a flat key scheme.

**S2 (Google) and H3 (Uber).** Hierarchical cell systems defined on the sphere. S2 projects onto a cube and uses a Hilbert curve so cell ids preserve locality; H3 uses hexagons so every neighbour is the same distance away, which makes radius searches and ring-based aggregation (surge pricing) clean. Both give you a `cell_id` you can index like any integer.

**Query algorithm**

1. Compute the set of cells that cover the 2 km circle at an appropriate resolution (a handful of cells).
2. Fetch candidates in those cells from the index.
3. Compute exact great-circle distance and discard points outside the radius.

**Keeping it fresh.** Driver locations update every few seconds, so store the current cell per driver in memory (Redis), update with a single write that removes from the old cell and adds to the new, and never put this churn through a relational index.
