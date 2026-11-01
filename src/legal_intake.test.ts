import { createHmac } from "node:crypto";
import { chooseFollowUp, intakeSchema, verifyWebhookSignature } from "./legal_intake.ts";

const matter = intakeSchema.parse({ matter_id: "M-104", client_name: "Ada Lovelace", document_id: "D-7", deadline_at: "2026-10-27T12:00:00.000Z" });
const raw = JSON.stringify(matter);
const signature = `sha256=${createHmac("sha256", "test-secret").update(raw).digest("hex")}`;
if (!verifyWebhookSignature(raw, signature, "test-secret")) throw new Error("signature should verify");
if (chooseFollowUp(matter, new Date("2026-10-25T12:00:00.000Z")) !== "follow-up") throw new Error("deadline decision should trigger follow-up");
console.log("legal intake test passed");
