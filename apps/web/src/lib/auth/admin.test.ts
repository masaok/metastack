import assert from "node:assert/strict";

import { isAdminEmail } from "./admin";

assert.equal(isAdminEmail("masaok@gmail.com"), true);
assert.equal(isAdminEmail(" Masaok@Gmail.com "), true);
assert.equal(isAdminEmail("other@gmail.com"), false);
assert.equal(isAdminEmail("masaok@gmail.com.evil.test"), false);
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(undefined), false);

console.log("admin email ok");
