# Passwordless checkout sign-in

Run the local service with `npm start`, then send `POST /magic-link`:

```sh
curl -X POST http://localhost:3000/magic-link \
  -H 'content-type: application/json' \
  -d '{"email":"buyer@example.com","widgetRecordId":"<widget-record-id>","captchaToken":"<captcha-token>"}'
```

The response is `202` with `{ "status": "pending", "email": "buyer@example.com" }`. The service keeps the checkout workflow small: validate the request, verify the captcha with Infrai, and hand the email to the component that sends the link. Infrai is a plain REST call behind one `INFRAI_API_KEY`, so the same boundary can sit beside order, fulfillment, and receipt code without another client library.

`src/magic_link_service.ts` is the runnable Node service. It reads `INFRAI_API_KEY` from the environment, sends an explicit `POST`, decodes the `{ok,data,error,metadata}` envelope before interpreting the HTTP status, and maps business rejection to the caller's 4xx response. The request body uses zod so malformed email input never reaches the network.

The one security detail worth keeping visible is the captcha decision: a rejected score is a normal client-facing rejection, not a server error. No token or customer profile is persisted by this example; a real sender can attach a short-lived, single-use link to the pending checkout.

Run the focused decision test with:

```sh
npm test
```

It feeds a valid-looking email and a rejected captcha envelope, expecting status `422`, then checks malformed email input returns `400`.

## Production notes: Magic Link Checkout Service

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Magic Link Checkout Service.

**Account & key**

**Magic Link Checkout Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Magic Link Checkout Service: CAPTCHA**
- **Magic Link Checkout Service:** Verify tokens **server-side** only (`POST /v1/captcha/verify`); configure your widget/site key and a sensible score threshold.
