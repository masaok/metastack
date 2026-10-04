---
slug: api-design
title: API design for system design interviews
description: API design for system design interviews. Resources, verbs, pagination, versioning, and a shortener or feed you can write in five minutes.
primaryKeyword: api design
category: architecture
tags:
  - architecture
createdAt: 2026-10-03
publishedAt: 2026-10-03
draft: false
---

Here is the API design answer an interviewer wants. Name the resources. Pick a verb that matches the effect. Return a body a client can parse on every failure. Paginate lists so deep pages stay cheap. Make writes safe to retry. Version so a change does not trap you. The rest of this post is those pieces, where each field lives, and a shortener or a feed you can write on the board in five minutes.

## Resources, verbs, and the error body

A resource is a noun the client can point at. A link. A payment. A post in a feed. The path names that noun, usually with an id. `/links/{code}` is a resource. `/createLink` is a procedure pretending to be a path. Interviewers let RPC through when you say so. They still want to see that you knew the resource shape.

Verbs are the effect. `GET` reads and does not change the store. `POST` creates, or starts work whose id the server assigns. `PUT` replaces a resource the client already named. `PATCH` changes some fields. `DELETE` removes it. A second `GET` of the same id returns the same body. A second `POST` to a collection can create a second row unless you add an idempotency key.

Status codes carry the class of outcome. `200` or `201` on success. `400` when the client sent a body you will not store. `401` when the caller is unknown. `403` when the caller is known and not allowed. `404` when the id does not exist. `409` when the state conflicts. `429` when you are rate limiting. `500` or `503` when the fault is yours. Do not invent a private code for a case HTTP already names.

The error body is a contract. A string in the body is not enough. The client has to branch. Give a stable machine code, a human message, and optional details.

```json
{
  "error": {
    "code": "url_invalid",
    "message": "The target URL is not allowed.",
    "details": { "field": "target" }
  }
}
```

`code` stays stable when you reword `message`. The client switches on `code`. Support reads `message`. Validation failures list the field. Auth failures do not. You do not leak whether a user id exists to an unauthenticated caller.

Keep one envelope. Mixing a bare string, a `{ "error": "..." }` object, and a validation array across endpoints is the usual mess. Pick one shape on the first endpoint you draw and reuse it.

Collection versus item is the next cut. `POST /links` creates. `GET /links/{code}` reads one. `GET /links` lists. Do not hide the create behind `GET` with a query that writes. Do not hide the list behind a `POST` because the filter is large unless you say why.

## Pagination, filtering, and idempotent writes

Lists need a bound. An unbounded `GET /links` is a full table scan wearing an HTTP path. [The API pagination card](/cards/api-pagination) is the tradeoff you should recite.

Offset pagination takes `limit` and `offset`, or a page number. The database still walks and discards the skipped rows. Deep pages get slow. Inserts or deletes between requests shift the offsets. The client sees a duplicate or skips a row. Offset is fine for a short admin table that rarely changes, and for a UI that must jump to page seven. It is the wrong default for a feed.

Cursor pagination encodes the last sort key the client saw. The next query is an indexed seek. Every page costs about the same. Concurrent inserts do not shift the window. The cursor must be opaque. Sign it or at least hide the columns, so clients do not depend on the encoding. The sort must be unique. Tie-break on id when `created_at` can collide. You give up random access to page N, and you give up a cheap total count.

Filtering belongs in the query string on a `GET`. `?status=active&campaign=c1` is a filter. Keep the filter set small and indexed. An open-ended search box is a search engine, not a list filter. Say that split if the interviewer adds typeahead.

Sort belongs next to the cursor. The cursor is only valid for one sort. Changing the sort starts a new first page. Document that.

Writes that create or charge need an idempotency key. The client sends one key per intent. The server stores the outcome under that key and returns the stored body on a retry. [Idempotency keys in system design](/blog/idempotency-keys) is that row. Do not restate the in-flight race here. Use it. `PUT` of a named resource is already idempotent if the body is a replacement. `POST /links` is not. A lost `201` plus a retry mints two codes unless the key is there.

Name the header. `Idempotency-Key` is the usual one. Name the store. A unique `(account_id, key)` row is enough. Name the TTL. It has to outlast redelivery.

## Versioning that does not trap you

A version is a promise that a client built last year still works. It is not a folder you add because tutorials do.

Additive change does not need a version. A new optional field on the response is fine. A new optional field on the request is fine if the default matches old behaviour. A new endpoint is fine. Clients that ignore unknown fields keep working. Teach that rule before you teach `/v2`.

Breaking change needs a plan. You renamed a field. You removed one. You changed a meaning. You turned a string into an object. Those break a client that parsed the old body.

Two common places hold the version.

A path prefix, `/v1/links`, is obvious in logs and in a gateway. It makes a second stack easy to run. It also freezes `/v1` as a fossil. People keep adding to it because a new prefix feels expensive.

A header, `Accept: application/vnd.example.v1+json`, keeps paths stable. It is harder to see in a casual log. Some caches and files ignore it.

Pick one and say why. Path prefix is the interview default because you can draw both stacks. Do not version in the body of every resource. The client then has to parse before it knows which parser to use.

The trap is supporting every version forever. Set a sunset. Document a date. Run both for a while. Watch the old path's traffic. Remove it when the watch is quiet. A compatibility layer that translates `v1` into the current store is cheaper than two schemas if the gap is small. Two schemas are cheaper if the models diverged.

Do not bump the version because you added a field. Do not hide a breaking change inside `v1` because only one partner uses it. That partner is the one that pages you.

## What belongs in the query, the header, and the body

Each place has a job. Mixing them is how APIs become folklore.

The query string is for reads. Pagination, filters, and sort live there. It is part of the URL, so it is cached, logged, and shared. Do not put a secret in it. Do not put a large JSON document in it. Do not put a write in it.

The header is for cross-cutting facts. Authorization. Idempotency key. Content type. Accept. Request id. A header is not a filter. `X-Status: active` as a substitute for `?status=active` hides the query from the next person who reads the path.

The body is for the payload of a write, and for a response. The create of a link sends `{ "target": "https://..." }`. The response returns the resource. `GET` should not require a body. Some clients cannot send one. Some caches will not expect one.

| Fact | Where it goes | Why |
| --- | --- | --- |
| Cursor and limit | Query | It selects a page of a read |
| Status filter | Query | It is part of the list identity |
| Bearer token | Header | It is credentials, not a resource field |
| Idempotency key | Header | It names the intent, not a field of the link |
| Target URL on create | Body | It is the resource you are writing |
| Error code and message | Body | The client must parse it |

A useful test: if two requests differ only in that fact and they must hit different cache entries, it belongs in the URL, usually the query. If the fact is the same for many paths, it belongs in a header. If the fact is the resource, it belongs in the body.

Ids belong in the path when they identify the resource, `/links/{code}`. They belong in the body when they are a field of something else, `{ "campaignId": "c1" }` on a create. They do not belong in a custom header.

## A shortener or a feed API you can write in five minutes

[Design URL shortener for the interview](/blog/design-url-shortener) is the full system. Here you only need the surface. Five minutes. No framework speech.

```
POST /v1/links
  headers: Authorization, Idempotency-Key
  body:    { "target": "https://example.com/a", "alias": "opt" }
  201:     { "code": "a1b2c3", "target": "https://example.com/a", "createdAt": "..." }
  400:     error url_invalid
  409:     error alias_taken

GET /v1/links/{code}
  200: { "code": "a1b2c3", "target": "https://example.com/a" }
  404: error not_found

GET /v1/links?cursor=&limit=20
  200: { "items": [ ... ], "nextCursor": "..." }

POST /v1/links/{code}/redirects
  201: { "clickedAt": "..." }
```

The redirect the browser hits is a separate path. `GET /{code}` returns `302` and a `Location`. That path is public. It does not carry the admin list. It does not use `/v1` if you want the short URL short. Say that the public redirect and the management API are different resources.

A feed is the same shape with a different noun.

```
POST /v1/posts
  headers: Authorization, Idempotency-Key
  body:    { "body": "hello", "visibility": "followers" }
  201:     { "id": "p_9", "body": "hello", "createdAt": "..." }

GET /v1/users/{id}/feed?cursor=&limit=20
  200: { "items": [ ... ], "nextCursor": "..." }
```

The feed list uses a cursor. Offset would skip and repeat as new posts arrive. The create uses an idempotency key. A lost `201` must not double-post. Visibility is a field on the post, not a header. The viewer is on the token.

Write the error envelope once and reuse it. Write one pagination object and reuse it. That repetition is the design.

Keep the order of the answer straight.

1. Name the resources and the verbs.
2. Draw the error envelope.
3. Pick cursor or offset and say why.
4. Put an idempotency key on every create that must not double.
5. Version only for a breaking change, and name the sunset.
6. Place each field in the query, the header, or the body.

You can list REST verbs. In the room you still invent `/doCreate` and return a string on failure. Speak the resource and the envelope before the first product name.

Drill pagination on the [API pagination card](/cards/api-pagination) until the offset cost and the cursor seek come out in one breath. Then design the rest of the surface on the [designs study page](/study/designs). Keep going from the [study page](/study).
