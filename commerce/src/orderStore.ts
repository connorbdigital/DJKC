/**
 * Where an order lives between two requests.
 *
 * A serverless function has no memory, so the order has to sit somewhere both
 * the webhook and the admin queue can reach. The interface is two reads and one
 * write — deliberately small, because everything else about an order is a pure
 * function in `orders.ts`.
 *
 * Two implementations:
 *
 *  - `memoryStore()` for tests and for the demo, which is the same code path
 *    with a Map instead of a network.
 *  - `kvStore()` against Upstash Redis over REST, which is what Vercel's KV
 *    marketplace gives you and which needs no client library, no connection pool
 *    and no cold-start reconnect.
 *
 * The shop works with no store configured only in the sense that it cannot take
 * money: a webhook that cannot record what happened must fail loudly (503) rather
 * than answer 200 and let Stripe believe the order was saved.
 */
import type { Order } from "./orders.js";

export interface OrderStore {
  get(orderId: string): Promise<Order | null>;
  /** Writes the order and the payment-intent index in one place. */
  put(order: Order): Promise<void>;
  /** Refunds arrive with a payment intent and no order id. */
  findByPaymentIntent(paymentIntentId: string): Promise<Order | null>;
}

export function memoryStore(seed: Order[] = []): OrderStore & { all(): Order[] } {
  const orders = new Map<string, Order>(seed.map((order) => [order.id, order]));
  const intents = new Map<string, string>();
  for (const order of seed) if (order.paymentIntentId) intents.set(order.paymentIntentId, order.id);

  return {
    async get(orderId) {
      return orders.get(orderId) ?? null;
    },
    async put(order) {
      orders.set(order.id, order);
      if (order.paymentIntentId) intents.set(order.paymentIntentId, order.id);
    },
    async findByPaymentIntent(paymentIntentId) {
      const id = intents.get(paymentIntentId);
      return id ? (orders.get(id) ?? null) : null;
    },
    all() {
      return [...orders.values()];
    },
  };
}

interface KvConfig {
  url: string;
  token: string;
}

/** Upstash Redis over REST: Vercel KV's variables, or Upstash's own. */
export function kvConfig(env: Record<string, string | undefined>): KvConfig | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function command(config: KvConfig, args: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The order store answered ${response.status}`);
  const body = (await response.json()) as { result?: unknown };
  return body.result;
}

export const orderKey = (orderId: string) => `order:${orderId}`;
export const intentKey = (paymentIntentId: string) => `intent:${paymentIntentId}`;

export function kvStore(config: KvConfig): OrderStore {
  return {
    async get(orderId) {
      const raw = await command(config, ["GET", orderKey(orderId)]);
      if (typeof raw !== "string" || !raw) return null;
      try {
        return JSON.parse(raw) as Order;
      } catch {
        return null;
      }
    },
    async put(order) {
      await command(config, ["SET", orderKey(order.id), JSON.stringify(order)]);
      if (order.paymentIntentId) {
        await command(config, ["SET", intentKey(order.paymentIntentId), order.id]);
      }
    },
    async findByPaymentIntent(paymentIntentId) {
      const id = await command(config, ["GET", intentKey(paymentIntentId)]);
      return typeof id === "string" && id ? this.get(id) : null;
    },
  };
}

export function storeFromEnv(env: Record<string, string | undefined>): OrderStore | null {
  const config = kvConfig(env);
  return config ? kvStore(config) : null;
}

/** The order id for a Stripe session, so a retried webhook finds the same order. */
export const orderIdForSession = (sessionId: string) => `ord_${sessionId}`;
