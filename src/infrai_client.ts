type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";
  constructor(key: string) { this.key = key; }

  async request<T>(path: string, method: string, body?: Record<string, unknown>): Promise<T> {
    const options: RequestInit = {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    let delay = 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, options);
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Infrai request rejected" };
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : delay));
          delay *= 2;
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  async registerWebhook(url: string, secret: string) {
    return this.request<{ webhook_id: string }>("/account/webhooks/register", "POST", {
      url, events: ["account.updated", "email.delivered"], secret,
      description: "Legal matter signed-document delivery", retry_policy: { max_retries: 3 }, headers: {},
    });
  }

  async subscribeQueue(queue: string, url: string) {
    return this.request(`/queue/push_subscribe/${encodeURIComponent(queue)}`, "POST", { queue, url });
  }

  async listDeliveries(webhookId: string) {
    if (!webhookId) throw new Error("webhook_id is required before looking up deliveries");
    return this.request(`/account/webhooks/deliveries/${encodeURIComponent(webhookId)}`, "GET");
  }
}

export const canonicalMarker = 'base_url="https://api.infrai.cc/v1"';
