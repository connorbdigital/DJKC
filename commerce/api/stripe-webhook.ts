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
import { prodigiAdapter, type ProdigiItem } from "../src/suppliers/prodigi.js";
import type { SupplierAdapter } from "../src/orders.js";

const rawBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

/**
 * Which supplier, if any, can be reached without a human.
 *
 * `SUPPLIER_NAME` decides, and a missing key means "not reachable" rather than
 * "fail the payment": the order is recorded either way and waits in the manual
 * queue. Both adapters refuse rather than improvise — BigBuy without a currency
 * rate, Prodigi without a product mapping or print-ready artwork.
 *
 * `PRODIGI_ITEMS` is JSON: `{ "HG-PRINT-01": { "sku": "GLOBAL-CAN-16X20",
 * "asset": "https://…/art.png" } }`, keyed by the SKU the order line carries.
 */
const prodigiItems = (): Record<string, ProdigiItem> => {
  const raw = (process.env.PRODIGI_ITEMS ?? "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, ProdigiItem>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const adapterFor = (): SupplierAdapter | null => {
  const supplier = (process.env.SUPPLIER_NAME ?? "").trim().toLowerCase();

  if (supplier === "prodigi") {
    const key = (process.env.PRODIGI_API_KEY ?? "").trim();
    if (!key) return null;
    return prodigiAdapter({
      apiKey: key,
      items: prodigiItems(),
      /* Sandbox by default when the key is a sandbox key; explicit override wins. */
      baseUrl:
        process.env.PRODIGI_API_BASE?.trim() ||
        (key.startsWith("sandbox_") ? "https://api.sandbox.prodigi.com/v4.0" : "https://api.prodigi.com/v4.0"),
      ...(process.env.PRODIGI_SHIPPING_METHOD ? { shippingMethod: process.env.PRODIGI_SHIPPING_METHOD as "Budget" | "Standard" | "Express" | "Overnight" } : {}),
    });
  }

  if (supplier !== "bigbuy") return null;
  const key = (process.env.BIGBUY_API_KEY ?? "").trim();
  if (!key) return null;
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
