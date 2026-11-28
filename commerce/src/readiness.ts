/**
 * What the shop is actually missing, as a list rather than a shrug.
 *
 * "Is it live?" has three different answers here — can it take money, can it
 * remember what was bought, can it get the parcel sent — and they depend on
 * different variables. Reading that from a URL beats guessing from a screenshot,
 * and it means a missing secret is a named sentence rather than a 503 in a log.
 *
 * Nothing here reads or returns a value: only whether it is set, and how long it
 * is (a wrong-length key is the most common reason a correct-looking setup fails).
 */
import { kvConfig } from "./orderStore.js";

export interface Check {
  name: string;
  state: "set" | "missing" | "invalid";
  unlocks: string;
  note?: string;
}

export interface Readiness {
  checks: Check[];
  canTakeMoney: boolean;
  canRecordOrders: boolean;
  canFulfilAutomatically: boolean;
  supplier: string | null;
  /** The next one thing to do, in words. */
  next: string;
}

export function readiness(env: Record<string, string | undefined>): Readiness {
  const value = (key: string) => (env[key] ?? "").trim();
  const checks: Check[] = [];

  const stripeKey = value("STRIPE_SECRET_KEY");
  checks.push({
    name: "STRIPE_SECRET_KEY",
    state: stripeKey ? "set" : "missing",
    unlocks: "the checkout can create a Stripe session instead of answering 503",
    ...(stripeKey ? { note: stripeKey.startsWith("sk_live") ? "live key" : "test key" } : {}),
  });

  const webhookSecret = value("STRIPE_WEBHOOK_SECRET");
  checks.push({
    name: "STRIPE_WEBHOOK_SECRET",
    state: webhookSecret ? "set" : "missing",
    unlocks: "the webhook can trust that a payment really happened",
  });

  const kv = kvConfig(env);
  checks.push({
    name: "KV_REST_API_URL + KV_REST_API_TOKEN",
    state: kv ? "set" : "missing",
    unlocks: "a paid order can be written down, so Stripe can stop retrying",
    note: kv ? undefined : "an Upstash/Vercel KV store, connected to this project, sets both",
  });

  const supplier = value("SUPPLIER_NAME").toLowerCase();
  const prodigiKey = value("PRODIGI_API_KEY");
  const bigbuyKey = value("BIGBUY_API_KEY");
  const supplierKey = supplier === "prodigi" ? prodigiKey : supplier === "bigbuy" ? bigbuyKey : "";

  checks.push({
    name: "SUPPLIER_NAME",
    state: supplier ? "set" : "missing",
    unlocks: "which supplier the paid order is handed to; anything else means fulfil by hand",
    ...(supplier ? { note: supplier } : {}),
  });

  if (supplier) {
    checks.push({
      name: supplier === "prodigi" ? "PRODIGI_API_KEY" : "BIGBUY_API_KEY",
      state: supplierKey ? "set" : "missing",
      unlocks: "the order is placed with the supplier without anyone touching it",
    });
  }

  if (supplier === "prodigi") {
    const items = value("PRODIGI_ITEMS");
    let state: Check["state"] = "missing";
    if (items) {
      try {
        const parsed = JSON.parse(items) as unknown;
        state = parsed && typeof parsed === "object" && Object.keys(parsed as object).length ? "set" : "invalid";
      } catch {
        state = "invalid";
      }
    }
    checks.push({
      name: "PRODIGI_ITEMS",
      state,
      unlocks: "which Prodigi product and print file each SKU becomes",
      note: state === "invalid" ? "present but not readable JSON with at least one SKU" : undefined,
    });
  }

  const canTakeMoney = Boolean(stripeKey);
  const canRecordOrders = Boolean(webhookSecret && kv);
  const canFulfilAutomatically = Boolean(canRecordOrders && supplier && supplierKey);

  const next = !stripeKey
    ? "Set STRIPE_SECRET_KEY on this project (Stripe → Developers → API keys, the secret key)."
    : !webhookSecret
      ? "Create the Stripe webhook endpoint at /api/stripe-webhook for checkout.session.completed, checkout.session.expired and charge.refunded, then copy its signing secret into STRIPE_WEBHOOK_SECRET."
      : !kv
        ? "Connect an Upstash/Vercel KV store to this project, so a paid order has somewhere to live."
        : !supplier
          ? "Set SUPPLIER_NAME (prodigi or bigbuy) once there is an account, or leave it and fulfil the first orders by hand."
          : !supplierKey
            ? `Add the ${supplier === "prodigi" ? "PRODIGI_API_KEY" : "BIGBUY_API_KEY"} for the ${supplier} account.`
            : "Nothing missing: the chain is complete. Place one sandbox order before trusting it.";

  return { checks, canTakeMoney, canRecordOrders, canFulfilAutomatically, supplier: supplier || null, next };
}
