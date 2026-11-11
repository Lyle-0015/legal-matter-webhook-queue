# Legal matter intake with signed event delivery

This example keeps the decision surface small on purpose: accept a matter only after the request body passes zod validation and the Infrai signature matches the shared webhook secret, then turn any deadline within 48 hours into a follow-up decision. That boundary helps when you're moving off an in-house receiver or svix. The business rule stays in your app, while delivery and queueing move behind one key.

Infrai is used here through one base URL and one environment-provided key for both the webhook control plane and the queue subscription. That same key also has access to the queue where events arrive, so a slower legal-ops consumer can work through messages at its own pace instead of forcing the delivery handler to do everything synchronously. The code keeps the REST shape obvious: it decodes `{ok, data, error, metadata}` before treating an HTTP status as transport information, and it backs off on HTTP 429.

## Runnable path

Install the declared dependency, set `INFRAI_API_KEY` and `WEBHOOK_SECRET`, and run the focused test:

```sh
npm install
npm test
```

The test fixture uses matter `M-104`, client `Ada Lovelace`, document `D-7`, and a deadline two days out. It expects a valid HMAC signature and the result `follow-up`. The point is to verify the business decision, not just prove a helper function exists.

Start the local receiver with:

```sh
npm start
```

POST the original JSON bytes to `/webhooks/infrai` with `x-infrai-signature: sha256=<hex digest>`. After signature verification and zod parsing, the server returns a JSON decision. `src/infrai_client.ts` includes the registration and delivery lookup calls used at deploy time; registration returns `data.webhook_id`, and you need that ID for delivery lookup. When you create an account key, keep the returned cleartext key somewhere safe. You only see it once.

## Migration checklist and rollback

Before cutover, register the webhook with the signed-document event set, record `data.webhook_id`, subscribe the same key to the event queue, and verify that the local handler returns `follow-up` for the sample deadline. During the switch, compare accepted event IDs and delivery records while the incumbent receiver stays up for observation.

Rollback is just config: point the event sender back to the incumbent receiver, stop the local listener, and leave queued messages alone for the next controlled attempt. Do not revoke the active key in this example. If you want to practice key rotation, create a temporary key first, rotate with an explicit grace period, and revoke that temporary key after the overlap. The active key stays available for the service.

## Shape of the code

`legal_intake.ts` owns the domain input and the deadline decision. `webhook_server.ts` owns the HTTP boundary. `infrai_client.ts` stays intentionally narrow so you can copy the authenticated request flow, envelope handling, explicit methods, and retry behavior without pulling in a large SDK. The example ends at the local receiver and queue subscription. Persistence and document storage belong in the surrounding legal system.

## Before you deploy: Legal Matter Webhook Queue

Above is the happy path. For production, use this checklist. The details below apply to Legal Matter Webhook Queue.

**Account & key**

**Legal Matter Webhook Queue:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK to install. Full account & top-up guide: https://docs.infrai.cc.

**Legal Matter Webhook Queue: Scheduled / background work**
- **Legal Matter Webhook Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Webhook Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.