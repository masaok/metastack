import assert from "node:assert/strict";

import { parseSettingsPatch } from "./settings";

// Valid keys survive, in any combination.
assert.deepEqual(parseSettingsPatch({ theme: "dark" }), { theme: "dark" });
assert.deepEqual(parseSettingsPatch({ newLimit: 25, mode: "quick", theme: "system" }), {
  newLimit: 25,
  mode: "quick",
  theme: "system",
});

// Invalid values are dropped rather than failing the whole patch.
assert.deepEqual(parseSettingsPatch({ theme: "sepia", mode: "quick" }), { mode: "quick" });
assert.deepEqual(parseSettingsPatch({ newLimit: 0 }), {});
assert.deepEqual(parseSettingsPatch({ newLimit: 101 }), {});
assert.deepEqual(parseSettingsPatch({ newLimit: 2.5 }), {});
assert.deepEqual(parseSettingsPatch({ newLimit: "10" }), {});

// Unknown keys and non-objects produce an empty patch.
assert.deepEqual(parseSettingsPatch({ admin: true }), {});
assert.deepEqual(parseSettingsPatch(null), {});
assert.deepEqual(parseSettingsPatch("dark"), {});

console.log("settings.test.ts passed");
