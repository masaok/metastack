---
id: qps-from-daily-active-users
deck: estimation
type: estimation
difficulty: 1
tags: [estimation, scalability]
prompt: >
  A product has 100 million daily active users who each make 20 requests a
  day. Estimate average and peak QPS, and explain the assumptions.
keyPoints:
  - Total requests per day, 100M × 20 = 2 billion
  - Seconds per day ≈ 86,400, round to 10^5 for mental math, so average ≈ 20,000 QPS (23,000 exact)
  - Peak is typically 2-5x average because traffic concentrates in waking hours and events, so plan for ~50,000-100,000 QPS
  - Separate reads from writes, often 10:1 or higher, since they scale differently
  - State assumptions out loud and round aggressively, the interviewer wants the method not the digits
eli5:
  - Multiply the number of daily users by how many requests each one makes
  - Divide by the seconds in a day, rounded to a hundred thousand to make the sum easy
  - Busy hours run at several times the average, so size for the busy hours
  - Count reads and writes separately, because there are far more reads and they grow in different ways
  - Say your guesses aloud and round boldly, because the method is what is being judged
distractors:
  - There are about 3,600 seconds in a day
  - Peak traffic equals the average, because requests spread evenly over 24 hours
  - 100M × 20 = 200 million requests per day
followUps:
  - How would a global user base versus a single-country user base change the peak multiplier?
  - What is the next number you need to size the database tier?
references:
  - title: Donne Martin, System design primer, Back-of-the-envelope calculations
    url: https://github.com/donnemartin/system-design-primer#back-of-the-envelope-calculations
  - title: Google SRE Book, Chapter 2, Handling overload
    url: https://sre.google/sre-book/handling-overload/
updated: 2026-10-02
reviewed: true
---

QPS is the first number every design needs because it decides whether you are talking about one server or a fleet.

**Step 1: requests per day.**
100 million DAU × 20 requests = 2 × 10^9 requests per day.

**Step 2: average QPS.**
There are 86,400 seconds in a day. Round to 100,000 (10^5) for speed; the error is under 15%.
2 × 10^9 / 10^5 = 2 × 10^4 ≈ **20,000 QPS average** (23,148 if you use 86,400).

**Step 3: peak QPS.**
Traffic is not flat. A single-country product sees most traffic in a 12-hour window with an evening spike; global products are flatter. A safe rule is peak = 2–3× average for global, 3–5× for regional or event-driven products.
Plan for **~50,000–100,000 QPS**.

**Step 4: split reads and writes.**
Ask or assume a ratio. A feed-style product might be 100 reads per write; a messaging product closer to 1:1. At 10:1 you would have ~18,000 reads/s and ~2,000 writes/s on average. Reads scale with caches and replicas; writes decide your primary database and sharding story.

**Step 5: sanity check.**
A well-tuned stateless web server handles 1,000–10,000 simple requests per second, so 100,000 peak QPS means tens of application servers behind a load balancer, which is normal. A single Postgres primary handles a few thousand writes per second comfortably, so 2,000 writes/s is fine, and 20,000 would push you to sharding.

Narrate every assumption: "I will assume 20 requests per user per day and a 3× peak factor; tell me if your numbers differ."
