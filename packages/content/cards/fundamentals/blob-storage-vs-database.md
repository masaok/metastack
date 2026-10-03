---
id: blob-storage-vs-database
deck: fundamentals
type: tradeoff
difficulty: 1
tags: [storage, scalability, cdn]
prompt: >
  Where do you store user-uploaded images and videos, and what goes in the
  database? How do clients upload and download them?
keyPoints:
  - Store the bytes in object storage (S3, GCS) and only metadata and the object key in the database
  - Object storage is cheap, durable (11 nines), and scales throughput independently of your database
  - Clients upload directly with presigned URLs so the bytes never pass through application servers
  - Serve downloads through a CDN in front of the bucket, with signed URLs for private content
  - Process derivatives (thumbnails, transcodes) asynchronously via events from the bucket
eli5:
  - Put the big file in a warehouse built for files, and keep only its label and location in the database
  - The file warehouse is cheap, almost never loses anything, and grows without slowing your database
  - Hand the user a temporary permission slip so they upload straight to the warehouse and skip your servers
  - Hand out downloads through copies near the user, with expiring passes for private files
  - Make thumbnails and conversions afterwards in the background, triggered when a file arrives
distractors:
  - text: Store the image bytes in a database BLOB column so files and metadata commit in one transaction and scale together
    why: Large blobs bloat the database, slow its backups and replication, and tie file throughput to database capacity
  - text: Route every upload through the application servers so they can stream the bytes onward to storage
    why: Proxying the bytes makes the application servers the bottleneck. Presigned URLs let clients upload straight to storage
  - text: Generate thumbnails synchronously inside the upload request so they exist before it returns
    why: Transcoding and resizing are slow, so doing them in the request makes uploads slow and fragile. They belong in background jobs
followUps:
  - How do you prevent an orphaned object when the database write fails after upload?
  - How would you support resumable uploads for multi-gigabyte files?
references:
  - title: AWS docs, Uploading objects with presigned URLs
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
  - title: AWS docs, Amazon S3 data durability
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html
updated: 2026-10-02
reviewed: true
---

Putting binary files in a relational database works at small scale and then hurts everywhere: backups balloon, replication lag grows, buffer cache fills with pixels, and every download ties up a database connection. The standard pattern separates bytes from facts.

**Object storage holds the bytes.** S3-style stores offer effectively unlimited capacity, eleven nines of durability through cross-AZ replication, lifecycle rules to tier cold objects to cheaper storage, and HTTP access to every object. Keys are opaque strings, so use something like `uploads/{user_id}/{uuid}.jpg` to avoid hot prefixes and leaking sequential ids.

**The database holds metadata.** A `media` row stores the owner, object key, content type, size, dimensions, processing status and permissions. Queries, listings and access control run against this row, never against the bucket.

**Uploads via presigned URLs.** The client asks your API for permission to upload; the API validates (size, type, quota), creates a pending `media` row, and returns a presigned PUT URL that is valid for a few minutes and bound to that key. The client uploads straight to the bucket. Your servers never see the bytes, so a thousand simultaneous 100 MB uploads cost you almost nothing. For large files use multipart upload so parts can be retried and resumed.

**Downloads via CDN.** Put a CDN in front of the bucket. Public assets use cache-friendly immutable URLs; private ones use short-lived signed URLs or signed cookies issued by your API after an authorisation check.

**Processing.** The bucket emits an event on object creation; a worker generates thumbnails or transcodes video, writes derivatives back, and marks the `media` row ready. The UI shows a placeholder until then.

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant S as Object store
  participant W as Worker
  C->>A: request upload (type, size)
  A-->>C: presigned PUT URL + media id
  C->>S: PUT bytes
  S-->>W: object created event
  W->>S: write thumbnails
  W->>A: mark media ready
```

Close with the orphan problem: a periodic job reconciles pending rows older than an hour against the bucket and deletes whichever side is missing.
