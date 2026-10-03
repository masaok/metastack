---
id: authn-authz-basics
deck: fundamentals
type: tradeoff
difficulty: 2
tags: [security, api, scalability]
prompt: >
  Compare server-side sessions with stateless JWTs for authenticating API
  requests. How do you handle logout and revocation in each?
keyPoints:
  - Sessions store state server side and hand the client an opaque id, so revocation is a delete and the token reveals nothing
  - JWTs carry signed claims so any service can verify them without a lookup, which scales horizontally and across services
  - JWTs cannot be revoked before expiry without reintroducing state, so keep them short lived and pair with refresh tokens
  - Store tokens in HttpOnly, Secure, SameSite cookies for browsers to limit XSS exposure
  - Authorisation is separate, check permissions on every request against the resource, not just the token's validity
eli5:
  - A session is a coat check ticket. The number means nothing by itself, and the desk can tear up its half whenever it likes
  - A JWT is a stamped wristband. Any door can check the stamp without phoning the front desk
  - A wristband works until it wears off, so make it wear off quickly and hand out a new one at the desk
  - Keep the ticket in a locked pocket that page scripts cannot reach into
  - Knowing who you are is not the same as letting you in. Each door still checks whether you may enter that room
followUps:
  - How would you rotate signing keys without logging everyone out?
  - Where do you put authorization checks in a microservice architecture?
references:
  - title: OWASP Cheat Sheet Series, Session management
    url: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
  - title: RFC 7519, JSON Web Token (JWT)
    url: https://datatracker.ietf.org/doc/html/rfc7519
updated: 2026-10-02
reviewed: true
---

**Server-side sessions.** On login the server creates a session record (user id, expiry, device) in a store such as Redis and returns a random opaque session id in a cookie. Every request looks the session up. Logout deletes the record; "sign out of all devices" deletes all of a user's records. The cookie itself leaks nothing if stolen from logs. The cost is a lookup per request and a session store that every instance must reach, which is fine within one system but awkward across many independent services.

**Stateless JWTs.** On login the server signs a token containing claims (`sub`, `exp`, roles). Any service with the public key verifies the signature locally with no network call, which is why JWTs dominate service-to-service and multi-service architectures. The catch is revocation: a signed token is valid until `exp` no matter what the server thinks. Mitigations:

- Keep access tokens short (5–15 minutes) and issue a longer-lived **refresh token** stored server side; logout revokes the refresh token so the user is out within minutes.
- Maintain a small **denylist** of revoked token ids checked on sensitive endpoints, which reintroduces some state.
- Include a `version` claim per user and bump it to invalidate everything.

**Browser storage.** Put the token in an `HttpOnly; Secure; SameSite=Lax` cookie so script cannot read it. `localStorage` is readable by any XSS payload. Cookies need CSRF protection; `SameSite` covers most of it.

**Authentication is not authorisation.** A valid token proves who is calling. Whether they may read *this* document is a per-request check against the resource's owner or an ACL, ideally centralised in one policy layer so every service enforces the same rules.

Pick sessions for a single web app that needs instant revocation; pick short-lived JWTs plus refresh tokens for APIs consumed by many services or mobile clients.
