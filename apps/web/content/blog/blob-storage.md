---
slug: blob-storage
title: Blob storage for system design interviews
description: Blob storage for system design interviews. Put bytes in an object store, keep the key in a row, and treat the pointer as a separate consistency problem.
primaryKeyword: blob storage
secondaryKeywords:
  - object storage
category: caching-and-storage
tags:
  - storage
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the blob storage answer an interviewer wants. Put the bytes in an object store. Put the owner, the key, the content type, and the permission in a database row. Clients upload with a presigned URL so the application servers never see the file. Clients download through a CDN. Treat the object and the pointer as two writes that can fail separately. That is the whole design. The rest of this post is the object model, why a photo must not live in a row, the consistency of those two writes, lifecycle and CDN, and what the MetaStack card already asks you to say.

## The object, the key, and the metadata

An object store is a key-value store for bytes. The value is the file. The key is a string you choose. The store also keeps a small set of attributes next to the object: content type, size, checksum, and any tags you attach. Those attributes travel with the object. They are not a substitute for a database row.

The key is an opaque path. A useful shape is `uploads/{user_id}/{uuid}.jpg`. The user id groups that person's objects if you ever need a prefix listing. The uuid keeps the name unguessable and avoids a hot prefix that every new upload would hit if you used a sequential integer. Do not leak an auto-increment id in a public URL.

Interviewers will also say object storage. Treat that phrase as the same family. A bucket holds objects. You talk to it over HTTP. Capacity is not the interesting limit. Throughput and request rate scale independently of your database. The store replicates across availability zones. [Amazon S3 documents eleven nines of durability](https://docs.aws.amazon.com/AmazonS3/latest/userguide/DataDurability.html) for that replication. You do not draw those copies. You pay for them.

What does not live on the object is anything you will query. Owner, album, moderation state, who may see the file, and the processing status of a thumbnail all belong in a row. The bucket is a bad index. Listing a prefix is for operations and for a reconciler, not for a product page.

```
object key     uploads/u_42/9f3a…c1.jpg
object bytes   the JPEG
object attrs   content-type, size, etag
database row   owner, key, width, height, status, acl
```

Say those four lines before you name a vendor. The interviewer is checking that you split bytes from facts.

A write is a PUT under that key. A read is a GET. Treat the object as immutable. A new version of a photo is a new key, and the row then points at it. A URL that already shipped does not change its bytes.

Mention multipart upload when the prompt has multi-gigabyte video, so a failed part retries. Mention a single PUT for a profile photo.

## A photo or a video that must not live in rows

A relational table can hold a binary column. That works for a handful of small files and then hurts in every operational path. Backups copy the pixels. Replicas stream the pixels. The buffer cache fills with JPEGs instead of rows you filter. A download holds a database connection for the length of the transfer. Throughput for files becomes throughput for the database.

Put the photo in the bucket. Put a few hundred bytes of metadata in the row. The [storage-for-photo-sharing estimate](/cards/storage-for-photo-sharing) makes the gap obvious: tens of terabytes of bytes per day, and a few gigabytes of metadata. The database must still take the inserts and serve the listings. It must not store the files.

The same split applies to video, PDFs, and export archives. If the value is a blob you hand to a browser or a player, it is not a row. If the value is a fact you filter, join, or constrain, it is a row. [SQL vs NoSQL for system design interviews](/blog/sql-vs-nosql) is the access-pattern test for the metadata. The blob store is not in that choice. It sits beside whichever store you pick for the facts.

A URL shortener is the opposite shape. [Design URL shortener for the interview](/blog/design-url-shortener) stores a short code and a long URL. Those are strings. They belong in a key-value lookup or a table. If that product later adds a preview image, the image is the first object. The mapping row then grows an object key. Do not start from the image and shove the URL into object metadata.

Walk a photo upload without drawing a brand.

1. The client tells the API the content type and the size.
2. The API checks quota, type, and authentication.
3. The API inserts a `media` row in a pending state and mints the object key.
4. The API returns a presigned PUT bound to that key and a short lifetime.
5. The client PUTs the bytes to the bucket. The application servers do not proxy the stream.
6. The bucket emits an object-created event.
7. A worker writes thumbnails to new keys and marks the row ready.

[Uploading with a presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) is the step that keeps your servers off the byte path. A thousand simultaneous 100 MB uploads then cost you API calls and row inserts, not socket buffers.

Synchronous thumbnailing inside the upload request is the common trap. Resize and transcode are slow. They belong in the worker. The UI shows a placeholder until the row is ready.

## Consistency of the object versus the pointer

Two writes have to succeed. The bytes land in the bucket. The row points at the key. Either write can fail. The interesting answers name both leftovers.

If the object lands and the row insert fails, you have an orphan object. It costs storage. Nobody can find it through the product. If the row lands and the upload never happens, you have a pending pointer. The product shows a file that 404s.

Pick an order and a repair.

The usual order is row first, then upload. Insert a pending row. Hand out the presigned URL. Mark the row ready only after the object exists. A pending row older than a timeout is deleted. A job HEADs the key and deletes the leftover. Objects without a row die on a staging-prefix lifecycle rule.

Upload-first is workable if the object lands in a staging prefix with a short expiry and you only keep it after the row commits.

Do not claim a single transaction across the bucket and the database. You do not have one. You have a workflow and a reconciler. Say that.

Reads have a similar split. The API authorises against the row. The bytes then come from the bucket or the CDN. A signed URL is a short-lived permission to GET that key. A public immutable URL is fine for bytes that anyone may see and that will never change. Mixing those two is how private photos leak.

If you replace a photo, write a new key and then swing the pointer. Readers who load the row see the new key. In-place overwrite of a key a CDN already cached is the version you should not choose.

## Lifecycle, CDN, and the database row that points at it

Three features sit on top of the split. Say them in this order: the row is the source of listing and access control, the CDN is the source of downloads, and lifecycle is how old bytes get cheaper.

The row answers who owns the file, whether it is ready, which thumbnail keys exist, and who may see it. A profile page never lists a bucket. It queries the table, then renders URLs the API is willing to issue.

The CDN sits in front of the bucket. Public assets use cache-friendly URLs. A content hash in the key makes the object immutable, so a long `Cache-Control` is safe. Private assets use signed URLs or signed cookies that the API issues after it checks the row. The CDN still helps. The signature is the gate.

Lifecycle rules move or expire objects by age or prefix. A photo unused for a year can move to a colder class. A staging prefix can expire in a day. If you expire the object, update the row. A row that still points at a cold key is a rare, more expensive read. Say that trade.

| Piece | Holds | Answers | Fails when |
| --- | --- | --- | --- |
| Object store | Bytes and object attributes | GET and PUT of a known key | You try to query by owner or album |
| Database row | Owner, key, status, ACL | Listing, permission, processing state | You put the file body in a column |
| CDN | Cached copies near the reader | Fast download of a URL you already issued | You cache a private object without a signature |
| Lifecycle | Age and prefix rules | Cost of old bytes, cleanup of staging | The row still claims a key you expired |

Processing stays event-driven. The bucket notifies a worker. The worker writes derivative keys and updates the row. [Message queues for system design interviews](/blog/message-queues-for-interviews) is the delivery story if they follow the event. The upload request does not wait for the transcode.

Clients talk to your API for permission and metadata, and to the bucket or CDN for bytes. Application servers stay off the byte path.

## What the blob-storage-vs-database card already asks you to say

[The blob-storage-versus-database card](/cards/blob-storage-vs-database) opens with a single prompt. Where do you store user-uploaded images and videos, and what goes in the database? How do clients upload and download them?

The card wants five things said out loud. Bytes go in object storage. Only metadata and the object key go in the database. Do not put the file in a binary column so the file and the facts can commit together. That couples file throughput to database capacity and bloats backups.

Name durability and scale as properties of the object store. Hand the client a presigned URL so the bytes never pass through the application servers. Serve downloads through a CDN, with signed URLs for private content. Process thumbnails and transcodes after the upload, on an object-created event.

The follow-ups are the orphan and the huge file. A reconciler deletes the leftover object or row. A multi-gigabyte file uses multipart upload.

A short answer you can reuse:

"Images and video go in object storage. The database holds the owner, the key, the type, and the ACL. The client uploads with a presigned URL. Downloads go through a CDN. Thumbnails are a worker. If one of the two writes fails, a job reconciles pending rows against the bucket."

Tick a line only when you said it. Then drill it until the split is automatic.

Start on the [fundamentals study page](/study/fundamentals).
