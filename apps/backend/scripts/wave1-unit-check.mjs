import assert from "node:assert/strict";
import { generateOpaqueToken, hashToken } from "../dist/lib/crypto.js";
import { AppError } from "../dist/lib/errors.js";
import { parseBody } from "../dist/lib/validate.js";
import { registerBodySchema } from "../dist/modules/auth/auth.schemas.js";

function testCrypto() {
  const token = generateOpaqueToken();
  assert.equal(typeof token, "string");
  assert.ok(token.length > 20);
  const a = hashToken(token);
  const b = hashToken(token);
  assert.equal(a, b);
  assert.notEqual(a, hashToken("other"));
}

function testValidation() {
  const ok = parseBody(registerBodySchema, {
    email: "user@example.com",
    password: "password123",
    firstName: "Ada",
  });
  assert.equal(ok.email, "user@example.com");

  assert.throws(
    () => parseBody(registerBodySchema, { email: "bad", password: "short" }),
    (error) => error instanceof AppError && error.code === "VALIDATION_ERROR",
  );
}

testCrypto();
testValidation();
console.log("Wave 1 unit checks passed");
