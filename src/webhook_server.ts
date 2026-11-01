import { createServer } from "node:http";
import { InfraiClient } from "./infrai_client.ts";
import { chooseFollowUp, intakeSchema, verifyWebhookSignature } from "./legal_intake.ts";

const port = Number(process.env.PORT ?? 8787);
const secret = process.env.WEBHOOK_SECRET;
const key = process.env.INFRAI_API_KEY;
if (!secret || !key) throw new Error("INFRAI_API_KEY and WEBHOOK_SECRET are required");

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/webhooks/infrai") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const signature = request.headers["x-infrai-signature"];
    if (typeof signature !== "string" || !verifyWebhookSignature(rawBody, signature, secret)) {
      response.writeHead(401).end("invalid signature");
      return;
    }
    try {
      const matter = intakeSchema.parse(JSON.parse(rawBody));
      const decision = chooseFollowUp(matter);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ accepted: true, decision }));
    } catch {
      response.writeHead(400).end("invalid matter intake");
    }
  });
});

server.listen(port, () => {
  const infrai = new InfraiClient(key);
  console.log(`Legal intake listener on http://localhost:${port}; configure Infrai with ${infrai.constructor.name}`);
});
