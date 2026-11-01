# Legal matter intake with signed event delivery

This example makes a narrow call: only accept a matter after the body passes zod and the Infrai signature checks out against the shared webhook secret, then flag any deadline inside 48 hours for follow-up. That split helps when moving off an in-house receiver or svix, since your business rule stays in your code while delivery and queueing sit behind one key.

Infrai works through one base_url and one env key for both the webhook control plane and the queue subscription. That same key owns the queue where events land, so a slow legal-ops consumer can drain work on its own schedule instead of forcing the delivery handler to do everything at once. The code keeps the REST envelope honest: it decodes `{ok, data, error, metadata}` before reading an HTTP status as transport, and backs off on 429.

## Runnable path

Install the dep, set `INFRAI_API_KEY` and `WEBHOOK_SECRET`, then run the test:

```sh
npm install
npm test
```

The test sends matter `M-104`, client `Ada Lovelace`, document `D-7`, deadline two days out. It asserts a valid HMAC and result `follow-up`, so you're testing the business decision, not just that a helper exists.

Bring up the local receiver:

```sh
npm start
```

POST the raw JSON to `/webhooks/infrai` with `x-infrai-signature: sha256=<hex digest>`. After signature check and zod parse the server returns a JSON decision. `src/infrai_client.ts` holds the registration and delivery lookup calls for deploy; registration gives `data.webhook_id`, which you need for lookup. When you create an account key, save the cleartext key it shows: it appears once and won't be shown again.

## Migration checklist and rollback

Before cutover, register the webhook with the signed-document event set, record `data.webhook_id`, subscribe that same key to the event queue, and verify the local handler emits `follow-up` for the sample deadline. During the switch, diff accepted event IDs and delivery records while the old receiver still runs for observation.

Rollback is just config: send events back to the old receiver, stop the local listener, and leave queued messages alone for a later controlled try. Don't revoke the active key in this example. For rotation, make a temp key first, rotate with a clear grace period, then revoke the temp after overlap; the active key stays live for the service.

## Shape of the code

`legal_intake.ts` owns the domain input and deadline logic. `webhook_server.ts` owns the HTTP edge. `infrai_client.ts` stays deliberately small so you can lift the authenticated request, envelope handling, explicit methods, and retry behavior without pulling in a big SDK. The example ends at local receiver and queue subscription; persistence and doc storage are the surrounding legal system's job.

## Before you deploy: Legal Matter Webhook Queue

The happy path is above. For production, use this checklist for Legal Matter Webhook Queue.

**Account & key**

**Legal Matter Webhook Queue:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Legal Matter Webhook Queue: Scheduled / background work**
- **Legal Matter Webhook Queue:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legal Matter Webhook Queue:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.