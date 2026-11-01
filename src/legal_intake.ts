import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const intakeSchema = z.object({
  matter_id: z.string().min(1),
  client_name: z.string().min(1),
  document_id: z.string().min(1),
  deadline_at: z.string().datetime(),
});

export type MatterIntake = z.infer<typeof intakeSchema>;

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function chooseFollowUp(matter: MatterIntake, now = new Date()): "follow-up" | "wait" {
  const deadline = new Date(matter.deadline_at);
  const hours = (deadline.getTime() - now.getTime()) / 3_600_000;
  return hours <= 48 ? "follow-up" : "wait";
}
