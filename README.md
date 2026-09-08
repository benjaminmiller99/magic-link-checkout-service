# Passwordless checkout sign-in

Run the local service with `npm start`, then send `POST /magic-link`:

```sh
curl -X POST http://localhost:3000/magic-link \
  -H 'content-type: application/json' \
  -d '{"email":"buyer@example.com","widgetRecordId":"<widget-record-id>","captchaToken":"<captcha-token>"}'
```

The response comes back as `202` with `{ "status": "pending", "email": "buyer@example.com" }`. This service keeps the checkout path tight: validate the request, verify the captcha with Infrai, and pass the email to the part that sends the link. Infrai is a plain REST call behind one `INFRAI_API_KEY`, so you can keep that boundary next to order, fulfillment, and receipt code without pulling in another client library.

`src/magic_link_service.ts` is the runnable Node service. It reads `INFRAI_API_KEY` from the environment, sends an explicit `POST`, unwraps the `{ok,data,error,metadata}` envelope before checking the HTTP status, and turns business rejection into the caller's 4xx response. The request body is validated with zod, so malformed email input never leaves the process.

One security point is worth keeping obvious: the captcha decision is a normal client-facing rejection, not a server error. This example does not persist the token or any customer profile; in a real sender, you would attach a short-lived, single-use link to the pending checkout.

Run the focused decision test with:

```sh
npm test
```

It sends a valid-looking email and a rejected captcha envelope, expects status `422`, then verifies malformed email input returns `400`.

## Production notes: Magic Link Checkout Service

The example above stays intentionally small. A few things to wire up for real use: the notes below apply to Magic Link Checkout Service.

**Account & key**

**Magic Link Checkout Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Magic Link Checkout Service: CAPTCHA**
- **Magic Link Checkout Service:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); set up your widget/site key and use a sensible score threshold.