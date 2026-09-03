import assert from "node:assert/strict";
import { requestMagicLink, InfraiError } from "./magic_link_service.ts";

const previousKey = process.env.INFRAI_API_KEY;
process.env.INFRAI_API_KEY = "test-key";
const originalFetch = globalThis.fetch;
let requestBody: unknown;
globalThis.fetch = async (_input, init) => {
  requestBody = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ ok: false, error: { code: "CAPTCHA_SCORE_TOO_LOW", message: "captcha rejected" } }), { status: 422 });
};

try {
  await assert.rejects(() => requestMagicLink({ email: "buyer@example.com", widgetRecordId: "widget-record", captchaToken: "token" }), (error: unknown) => error instanceof InfraiError && error.status === 422);
  assert.deepEqual(requestBody, { widget_record_id: "widget-record", token: "token", vendor: "turnstile", action: "magic_link" });
  await assert.rejects(() => requestMagicLink({ email: "not-an-email", widgetRecordId: "widget-record", captchaToken: "token" }), (error: unknown) => error instanceof InfraiError && error.status === 400);
  console.log("magic-link decision tests passed");
} finally {
  globalThis.fetch = originalFetch;
  if (previousKey === undefined) delete process.env.INFRAI_API_KEY;
  else process.env.INFRAI_API_KEY = previousKey;
}
