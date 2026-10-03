import assert from "node:assert/strict";

import { isAdminAccount, isAdminEmail } from "./admin";

assert.equal(isAdminEmail("masaok@gmail.com"), true);
assert.equal(isAdminEmail(" Masaok@Gmail.com "), true);
assert.equal(isAdminEmail("other@gmail.com"), false);
assert.equal(isAdminEmail("masaok@gmail.com.evil.test"), false);
assert.equal(isAdminEmail(null), false);
assert.equal(isAdminEmail(undefined), false);
assert.equal(isAdminAccount({ login: "masaok", email: null }), true);
assert.equal(isAdminAccount({ login: "Masaok", email: null }), true);
assert.equal(isAdminAccount({ login: "someone", email: "masaok@gmail.com" }), true);
assert.equal(isAdminAccount({ login: "someone", email: "other@gmail.com" }), false);
assert.equal(isAdminAccount({ login: "masaok-other", email: null }), false);

console.log("admin email ok");
