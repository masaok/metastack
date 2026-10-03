---
id: cloud-file-sync
deck: designs
type: design
difficulty: 3
tags: [storage, consistency, realtime]
prompt: >
  Design a file sync service like Dropbox: files edited on one device appear
  on all the user's devices, with large files, conflict handling and
  bandwidth efficiency.
keyPoints:
  - Splits files into content-addressed chunks so only changed chunks upload and identical chunks deduplicate across users
  - Separates the metadata service (file tree, versions, chunk lists) from block storage (object store for chunks)
  - Uses a notification channel (long polling or WebSocket) to tell clients about changes, then clients pull metadata and missing chunks
  - Detects conflicts with version vectors or parent-version checks and resolves by creating a "conflicted copy" rather than losing data
  - Handles offline edits, resumable transfers and client-side change detection via a local index and filesystem watchers
eli5:
  - Cut each file into pieces named after their contents, so you only send pieces that changed and never store the same piece twice
  - One service keeps the catalogue of which pieces make each file, and a separate warehouse holds the pieces
  - The server taps the client on the shoulder when something changed, and the client then fetches what it is missing
  - If two people changed the same file, keep both copies and label one as conflicted instead of throwing work away
  - The client keeps its own list of local files, notices edits made offline, and can pick up a half-finished transfer
followUps:
  - How do you handle a file that is being edited simultaneously on two devices?
  - How would you implement shared folders and permission changes efficiently?
stages:
  - name: Requirements
    keyPoints:
      - Upload, download, sync across devices, file history, sharing, works offline and reconciles later
      - Large files (GBs), minimal bandwidth, strong durability, changes visible on other devices within seconds
  - name: Estimates
    keyPoints:
      - e.g. 100M users × 200 files × 500 KB ≈ 10 PB logical, dedup brings it down, 3x replication or erasure coding on top
      - Mostly small files, occasional large ones, metadata operations dominate request volume
  - name: API
    keyPoints:
      - Client to metadata, GET /changes?cursor, POST /commit with file path, chunk hashes and parent version
      - Client to block store, PUT/GET chunk by hash via presigned URLs, HEAD to check existence
  - name: Data model
    keyPoints:
      - files(id, owner/namespace, path, version, size, chunk_hashes[], modified_at, deleted), per-namespace change journal
      - chunks(hash PK, size, storage_key, refcount) for deduplication
  - name: High-level design
    keyPoints:
      - Client watcher detects change → chunker hashes chunks → uploads missing chunks → commits metadata → server appends to journal → notifies other devices
      - Metadata DB sharded by user/namespace, block storage in object store, notification service for device wakeups
  - name: Deep dives
    keyPoints:
      - Content-defined chunking (rolling hash) so an insert in the middle does not shift every chunk
      - Commit with parent version, server rejects if parent is stale and the client creates a conflicted copy
      - Deduplication and refcounting with garbage collection of unreferenced chunks
  - name: Bottlenecks and failure
    keyPoints:
      - Notification fan-out to many devices, use long polling with per-namespace channels
      - Metadata DB hot for users with huge trees, shard by namespace and paginate changes
      - Partial uploads resumed by checking which chunk hashes already exist
references:
  - title: Dropbox Tech Blog, Streaming file synchronization
    url: https://dropbox.tech/infrastructure/streaming-file-synchronization
  - title: Dropbox Tech Blog, Rewriting the heart of our sync engine
    url: https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine
updated: 2026-10-02
reviewed: true
---

## Requirements

A user installs a client on several devices; any file saved into the synced folder appears on the others within seconds. Files can be gigabytes; bandwidth and storage should be used efficiently; edits made offline must reconcile without losing anything; users can view history and share folders. Durability must be essentially perfect.

## Estimates

100 million users with ~200 files averaging 500 KB is ~10 PB of logical data. Deduplication (the same installer, the same photo forwarded around) cuts that meaningfully; replication or erasure coding multiplies it back. Request volume is dominated by small metadata operations (listing changes, committing versions), not bytes.

## API

```text
GET  /namespaces/{ns}/changes?cursor=...      -> [{ path, version, chunkHashes[], deleted }], nextCursor
POST /namespaces/{ns}/commit                  { path, parentVersion, size, chunkHashes[] } -> { version } | 409 conflict
POST /chunks/presign                          { hashes[] } -> { missing: [{ hash, uploadUrl }] }
PUT  <presigned chunk URL>                    (raw bytes)
GET  <presigned chunk URL>
```

## Data model

`files(id, namespace_id, path, version, size, chunk_hashes[], modified_at, modified_by_device, deleted)` plus an append-only `journal(namespace_id, seq, file_id, version)` that clients page through by cursor. `chunks(hash PK, size, storage_key, refcount)` enables dedup. Namespaces are a user's root or a shared folder, and are the sharding unit.

## High-level design

```mermaid
flowchart LR
  subgraph client[Client]
    W[FS watcher] --> CH[Chunker + hasher]
    CH --> IDX[(Local index)]
  end
  CH -->|missing chunks| BS[(Block storage)]
  CH -->|commit| MS[Metadata service] --> MDB[(Metadata DB, sharded by namespace)]
  MS --> J[(Change journal)]
  MS --> NS[Notification service]
  NS -->|wake up| C2[Other devices]
  C2 -->|GET changes, GET chunks| MS & BS
```

A device detects a change, chunks the file, asks which chunk hashes the server lacks, uploads only those, then commits the new file version. The server validates the parent version, appends to the journal and pings the user's other devices, which fetch the change list and download missing chunks.

## Deep dives

**Chunking.** Fixed-size chunks break on inserts: adding one byte at the start shifts every boundary. Content-defined chunking uses a rolling hash to place boundaries at content patterns, so an edit only changes the chunks around it. Chunk hashes (SHA-256) are the content addresses used for dedup and integrity.

**Conflicts.** Each commit carries the `parentVersion` the client based its edit on. If the server's current version differs, another device committed first; the server rejects with `409`, and the client saves its version as `report (conflicted copy from laptop).docx` and commits that as a new file. No data is ever lost; the user merges manually. Version vectors can refine this for multi-master offline edits.

**Dedup and GC.** Chunks are shared across files and users via refcounts. Deleting a file decrements counts; a background collector removes chunks whose count hits zero after a grace period (so a quick undelete is free).

**Notifications.** Long polling per namespace works well: a device holds a request open; when the journal for any of its namespaces advances, the server responds and the device syncs. WebSockets are an alternative, but long polling survives corporate proxies better.

## Bottlenecks and failure modes

- **Metadata hot spots:** a user with millions of files makes listing and journal reads heavy; paginate aggressively and shard by namespace.
- **Large-file uploads:** resumable by design, because a retry asks "which chunks are missing" and uploads only those.
- **Notification storms:** a shared folder with 10,000 members gets one change → 10,000 wakeups; batch notifications and let clients debounce.
- **Clock and ordering:** never use client timestamps for conflict decisions; use server-assigned versions.
- **Durability:** chunks are immutable, which makes replication and verification simple; periodically re-hash stored chunks to detect bit rot.
