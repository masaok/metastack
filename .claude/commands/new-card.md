Create a new MetaStack flashcard.

Arguments: `$ARGUMENTS` is a short description of the card, optionally prefixed with the deck, for example `fundamentals: consistent hashing virtual nodes` or `designs: rate limiter`.

Steps:

1. Read `packages/content/src/schema.ts` for the current tag vocabulary and field rules, and `CONTRIBUTING.md` for the writing rules.
2. Read two existing cards in the target deck to match tone and depth.
3. Pick a kebab-case `id` that does not already exist in `packages/content/cards/`.
4. Write `packages/content/cards/<deck>/<id>.md` with:
   - A prompt phrased the way an interviewer asks it.
   - 3 to 6 key points, each a thing a strong answer says, in original wording.
   - For `type: design`, 5 to 7 `stages` (requirements, estimates, API, data model, high-level design, deep dives, bottlenecks) with their own key points.
   - 1 or 2 follow-up questions.
   - At least one public reference (vendor docs, paper, or engineering blog), with a real URL you are confident exists.
   - A Markdown body of 150 to 400 words with a Mermaid diagram if it helps.
   - `updated` set to today and `reviewed: false`.
5. Run `pnpm validate` and fix anything it reports.
6. Report the file path and a one-paragraph summary of what the card tests.

Never copy wording from a course, book, or other flashcard deck.
