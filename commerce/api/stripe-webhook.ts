/**
 * The one URL Stripe is allowed to talk to.
 *
 * It does nothing itself: the body is read as bytes (not parsed, because the
 * signature covers the exact bytes), the environment is passed through, and the
 * decision is made in `src/stripeWebhookHandler.ts` where it can be tested.
 *
 * Configure the endpoint in Stripe for `checkout.session.completed`,
 * `checkout.session.expired` and `charge.refunded`, then copy the signing secret
 * into `STRIPE_WEBHOOK_SECRET` on this project.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { CATALOGUE } from "../lib/catalogue.js";
import { handleStripeWebhook } from "../src/stripeWebhookHandler.js";
import { storeFromEnv } from "../src/orderStore.js";
import { bigbuyAdapter } from "../src/suppliers/bigbuy.js";
import type { SupplierAdapter } from "../src/orders.js";

const rawBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

/**
 * Which supplier, if any, can be reached without a human.
 *
 * BigBuy is wired but only used when its key is present; the currency question
 * is left to the adapter, which refuses to quote without a rate rather than
 * inventing one. With no key, orders land in the manual queue.
 */
const adapterFor = (): SupplierAdapter | null => {
  const key = (process.env.BIGBUY_API_KEY ?? "").trim();
  if (!key) return null;
  if ((process.env.SUPPLIER_NAME ?? "").trim().toLowerCase() !== "bigbuy") return null;
  return bigbuyAdapter({
    apiKey: key,
    ...(process.env.BIGBUY_API_BASE ? { baseUrl: process.env.BIGBUY_API_BASE } : {}),
    language: process.env.BIGBUY_LANGUAGE ?? "en",
    ...(process.env.BIGBUY_PAYMENT_METHOD ? { paymentMethod: process.env.BIGBUY_PAYMENT_METHOD } : {}),
    ...(process.env.BIGBUY_CARRIERS ? { carriers: process.env.BIGBUY_CARRIERS.split(",").map((name) => name.trim()).filter(Boolean) } : {}),
  });
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result = await handleStripeWebhook({
    method: req.method ?? "GET",
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.method === "POST" ? await rawBody(req) : "",
    env: process.env as Record<string, string | undefined>,
    store: storeFromEnv(process.env as Record<string, string | undefined>),
    catalogue: CATALOGUE,
    adapterFor,
  });

  res.statusCode = result.status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(result.body));
}
