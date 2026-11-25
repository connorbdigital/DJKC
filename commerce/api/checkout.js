/**
 * Checkout: two prices, one POST, and a sentence when it cannot.
 *
 * The shop is static HTML, so this is the only part of it that runs anywhere. It
 * does one thing — turn a basket of ids into a Stripe Checkout session — and it is
 * read-only: no stock is decremented, no database is written, nothing is trusted
 * from the browser except ids and quantities.
 *
 * A GET answers about this function itself, so "checkout is broken" can be read
 * instead of guessed: /api/checkout in a browser says whether the key is set and
 * how many products it can price.
 */

import { CATALOGUE } from "../lib/catalogue.js";
import { DELIVERY, priceBasket, sessionBody, formatMoney } from "./pricing.js";

const STRIPE = "https://api.stripe.com/v1/checkout/sessions";
const TIMEOUT_MS = 12_000;

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const keyOf = () => (process.env.STRIPE_SECRET_KEY ?? "").trim();

/** The site's own address: what Stripe sends the customer back to. */
const baseUrlOf = (req) => {
  const configured = (process.env.SHOP_URL ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}`;
};

async function handle(req, res) {
  if (req.method === "GET") {
    json(res, 200, {
      ok: true,
      checkout: "alive",
      key: keyOf() ? "set" : "missing",
      mode: keyOf().startsWith("sk_live") ? "live" : keyOf() ? "test" : "none",
      catalogue: CATALOGUE.length,
      freeOver: formatMoney(DELIVERY.freeOver),
      delivery: formatMoney(DELIVERY.standard),
      currency: "GBP",
    });
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "Use POST with a basket." });
    return;
  }

  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || "{}");
  } catch {
    json(res, 400, { ok: false, error: "Send JSON like {\"items\":[{\"id\":\"HG-1001\",\"qty\":1}]}." });
    return;
  }

  const priced = priceBasket(CATALOGUE, payload?.items);
  if (!priced.ok) {
    json(res, 400, { ok: false, error: priced.problems.join(" "), problems: priced.problems });
    return;
  }

  const key = keyOf();
  if (!key) {
    /* 503 with the whole truth: what is missing, where it goes, and what the
       customer can do in the meantime. */
    json(res, 503, {
      ok: false,
      configured: false,
      priced: { subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total },
      error:
        "Payments are not switched on yet. The basket is priced and the delivery is worked out " +
        `(${formatMoney(priced.subtotal)} + ${formatMoney(priced.shipping)}), but no Stripe key is set on this ` +
        "deployment, so no card is taken. Set STRIPE_SECRET_KEY in the ecommerce project and it starts working.",
    });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = sessionBody({
      lines: priced.lines,
      shipping: priced.shipping,
      baseUrl: baseUrlOf(req),
      successPath: "/pages/order-complete.html",
      cancelPath: "/shop.html?cancelled=1",
    });
    const upstream = await fetch(STRIPE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `${Date.now()}-${priced.subtotal}-${priced.lines.length}`,
      },
      body,
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      let said = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text);
        said = parsed?.error?.message ?? said;
      } catch {
        /* keep the raw text */
      }
      json(res, 502, {
        ok: false,
        status: upstream.status,
        error: `Stripe refused the session (${upstream.status}): ${said}`,
      });
      return;
    }
    const session = JSON.parse(text);
    json(res, 200, {
      ok: true,
      url: session.url,
      id: session.id,
      priced: { subtotal: priced.subtotal, shipping: priced.shipping, total: priced.total },
    });
  } catch (problem) {
    json(res, 502, {
      ok: false,
      error:
        problem instanceof Error && problem.name === "AbortError"
          ? "Stripe did not answer in time."
          : `Stripe could not be reached: ${problem instanceof Error ? problem.message : String(problem)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  try {
    await handle(req, res);
  } catch (problem) {
    if (res.headersSent) return;
    json(res, 500, {
      ok: false,
      error: `The checkout function itself failed: ${problem instanceof Error ? problem.message : String(problem)}`,
    });
  }
}
