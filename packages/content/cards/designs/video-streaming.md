---
id: video-streaming
deck: designs
type: design
difficulty: 3
tags: [streaming, cdn, storage]
prompt: >
  Design a video platform like YouTube: upload, transcode, store and stream
  videos to millions of concurrent viewers with adaptive quality.
keyPoints:
  - Uploads go directly to object storage via presigned, resumable multipart uploads, then an event triggers processing
  - Transcoding is a DAG of parallel jobs (split into chunks, encode each chunk at every rendition, stitch, generate thumbnails) on a worker fleet
  - Streaming uses HLS or DASH, short segments plus a manifest, so clients switch bitrates per segment
  - Delivery is CDN-first with origin shield, since egress at Tbps scale cannot come from a datacenter
  - Metadata (titles, views, comments) lives in a separate service and database from the bytes
eli5:
  - The uploader sends the file straight to bulk storage in parts that can resume, and its arrival kicks off processing
  - Cut the video into pieces, convert every piece into each quality level on many workers at once, then join them and make thumbnails
  - The video is served as short clips plus a list of them, so the player can change quality from one clip to the next
  - Copies near viewers do the delivering, because no single building has enough outgoing capacity
  - Titles, view counts and comments live in a different service and database from the video files
followUps:
  - How do you make a newly uploaded video watchable quickly instead of waiting for all renditions?
  - How would live streaming change the pipeline and the latency expectations?
stages:
  - name: Requirements
    keyPoints:
      - Upload videos, process to multiple qualities, stream smoothly on varying networks, show metadata and view counts
      - High availability for playback, large files (GBs), global audience, cost-conscious egress
  - name: Estimates
    keyPoints:
      - e.g. 5M concurrent viewers × 3 Mbps = 15 Tbps peak egress, 500 hours uploaded per minute ≈ 1 PB/day of source
      - Renditions multiply storage 3-4x, so tens of PB per month
  - name: API
    keyPoints:
      - POST /videos → upload URL(s), PUT parts to storage, POST /videos/{id}/complete
      - GET /videos/{id} metadata including manifest URL, GET manifest and segments from the CDN
  - name: Data model
    keyPoints:
      - videos(id, owner, title, status, duration, renditions[], manifest_key), separate counters for views
      - Object storage layout, source/{id}, renditions/{id}/{quality}/{segment}.ts
  - name: High-level design
    keyPoints:
      - Upload service issues presigned URLs, storage event enqueues transcode job, orchestrator fans out chunk jobs to workers
      - Playback, client fetches metadata, then manifest and segments via CDN, telemetry reports quality
  - name: Deep dives
    keyPoints:
      - Chunked parallel transcoding reduces a 1-hour video from hours to minutes
      - Adaptive bitrate via HLS/DASH manifests, client picks rendition per segment by measured bandwidth
      - Processing lowest rendition first so the video is watchable within minutes
  - name: Bottlenecks and failure
    keyPoints:
      - Egress cost drives CDN hit rate optimisation and ISP-embedded caches
      - Viral videos cause origin shield load, pre-warm popular content
      - Transcode failures retried per chunk, idempotent outputs, poison inputs dead-lettered
references:
  - title: Netflix Tech Blog, High quality video encoding at scale
    url: https://netflixtechblog.com/high-quality-video-encoding-at-scale-d159db052746
  - title: Apple developer docs, HTTP Live Streaming
    url: https://developer.apple.com/documentation/http-live-streaming
updated: 2026-10-02
reviewed: true
---

## Requirements

Creators upload videos of any length (multi-gigabyte files); the platform processes them into several qualities; viewers stream smoothly on networks from 3G to fibre, worldwide; metadata (title, description, view counts, comments) is searchable and updatable. Playback must be highly available and cheap per view, because egress is the dominant cost.

## Estimates

Peak of 5 million concurrent viewers at an average 3 Mbps is **15 Tbps** of egress. 500 hours of video uploaded per minute at ~1.4 GB/hour of source is ~1 PB/day of uploads, and renditions multiply stored bytes by 3–4×. These two numbers say: the CDN *is* the product's delivery architecture, and storage must be object storage with lifecycle tiering.

## API

```text
POST /videos                     { title, size, contentType }   -> { videoId, uploadId, partUrls[] }
PUT  <presigned part URL>        (client uploads parts directly to storage)
POST /videos/{id}/complete       { parts: [{ etag, number }] }
GET  /videos/{id}                -> { title, status, duration, manifestUrl, thumbnails }
GET  <cdn>/{id}/master.m3u8      -> manifest listing renditions
GET  <cdn>/{id}/720p/seg-00042.ts
```

## Data model

`videos(id, owner_id, title, description, status: uploading|processing|ready|failed, duration, created_at, manifest_key)`, `renditions(video_id, quality, codec, bitrate, segment_count)`, `view_counts(video_id, day, count)` updated asynchronously. Object storage holds `source/{id}` and `renditions/{id}/{quality}/seg-{n}.ts` plus manifests and thumbnails.

## High-level design

```mermaid
flowchart LR
  subgraph ingest[Ingest]
    C[Creator] -->|presigned multipart| OS[(Object storage: source)]
    OS -->|event| ORC[Transcode orchestrator]
    ORC --> W[Worker fleet: split, encode, stitch, thumbs]
    W --> OR[(Object storage: renditions + manifests)]
    W --> MD[(Metadata DB)]
  end
  subgraph playback[Playback]
    V[Viewer] --> API[Metadata API] --> MD
    V --> CDN[CDN edge]
    CDN --> SH[Origin shield] --> OR
  end
```

## Deep dives

**Parallel transcoding.** Split the source into chunks at keyframe boundaries (say 10 seconds each). Encode every chunk at every rendition in parallel across hundreds of workers, then stitch and generate manifests. A one-hour video that would take hours to encode serially finishes in minutes. Model the pipeline as a DAG with idempotent steps so any failed step can be retried without redoing the rest.

**Adaptive bitrate streaming.** HLS and DASH split each rendition into short segments (2–6 s) and describe them in a manifest. The player measures throughput and buffer level and requests the next segment from whichever rendition fits, so quality steps down on a congested network instead of stalling. Segments are plain HTTP objects, which is exactly what CDNs cache best.

**Fast availability.** Encode the lowest rendition (e.g. 360p) first and publish a manifest with just that; add higher renditions as they finish. The creator sees "your video is live" in a couple of minutes.

**Delivery.** Edge PoPs serve segments from cache; misses go through an origin shield that collapses requests from many PoPs into one origin fetch. For the hottest content, caches embedded in ISP networks remove transit cost entirely.

## Bottlenecks and failure modes

- **Egress cost:** every percentage point of CDN hit rate is money; tune TTLs (segments are immutable, cache forever) and pre-warm trending videos.
- **Viral spikes:** a video going from zero to millions of viewers hits the shield hard for a few minutes; the shield plus request coalescing protects the origin.
- **Transcode storms:** a burst of uploads queues jobs; autoscale workers and prioritise by creator tier or expected popularity.
- **Corrupt or hostile uploads:** validate containers and codecs before encoding; sandbox the transcoder; dead-letter inputs that fail twice.
- **Metadata hot spots:** view counters on a viral video are a write hotspot; batch increments in a stream and update the database periodically.
