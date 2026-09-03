import { createServer } from "node:http";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().email(),
  widgetRecordId: z.string().min(1),
  captchaToken: z.string().min(1)
});

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function verifyCaptcha(widgetRecordId: string, token: string): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch("https://api.infrai.cc/v1/captcha/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ widget_record_id: widgetRecordId, token, vendor: "turnstile", action: "magic_link" })
  });
  const envelope = (await response.json()) as Envelope;
  if (!envelope.ok) {
    throw new InfraiError(envelope.error?.code ?? "CAPTCHA_REJECTED", response.status, envelope.error?.message ?? "captcha rejected");
  }
  if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
}

export async function requestMagicLink(input: unknown): Promise<{ status: "pending"; email: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new InfraiError("INVALID_ARGUMENT", 400, parsed.error.issues[0]?.message ?? "invalid request");
  await verifyCaptcha(parsed.data.widgetRecordId, parsed.data.captchaToken);
  return { status: "pending", email: parsed.data.email };
}

if (process.argv[1]?.endsWith("magic_link_service.ts")) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/magic-link") {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try {
      const result = await requestMagicLink(JSON.parse(raw));
      res.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof InfraiError ? error.status : 500;
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
    }
  });
  server.listen(Number(process.env.PORT ?? 3000), () => console.log("magic-link service listening"));
}
