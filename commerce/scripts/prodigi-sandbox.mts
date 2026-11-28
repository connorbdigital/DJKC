/**
 * One real round trip against Prodigi's sandbox, from the terminal.
 *
 * This is the honest version of "does the integration work": it prices a basket,
 * places an order the sandbox will never print, and asks for the status back. It
 * prints exactly what Prodigi said. It does not claim success it did not see, and
 * it will not run without a sandbox key.
 *
 *   PRODIGI_API_KEY=sandbox_xxx \
 *   PRODIGI_SMOKE_SKU=GLOBAL-CAN-16X20 \
 *   PRODIGI_SMOKE_ASSET=https://your-host/art/print.png \
 *   npm run smoke:prodigi
 *
 * The key and the artwork URL are the two things that have to be real. The SKU
 * has to be one Prodigi actually sells — the catalogue in their dashboard is the
 * only source for that, and a made-up one is rejected by their API, not by this
 * script.
 */
import { prodigiAdapter } from "../src/suppliers/prodigi.js";
import type { OrderAddress } from "../src/orders.js";

const key = (process.env.PRODIGI_API_KEY ?? "").trim();
const sku = (process.env.PRODIGI_SMOKE_SKU ?? "").trim();
const asset = (process.env.PRODIGI_SMOKE_ASSET ?? "").trim();
const baseUrl = (process.env.PRODIGI_API_BASE ?? "https://api.sandbox.prodigi.com/v4.0").trim();

if (!key || !sku || !asset) {
  console.error(
    [
      "Nothing was sent. This needs three things:",
      "  PRODIGI_API_KEY     a sandbox key from the Prodigi dashboard",
      "  PRODIGI_SMOKE_SKU   a real Prodigi product SKU, e.g. GLOBAL-CAN-16X20",
      "  PRODIGI_SMOKE_ASSET a public https URL of a print-ready PNG or JPEG",
      "",
      "It runs against https://api.sandbox.prodigi.com/v4.0 unless PRODIGI_API_BASE says otherwise.",
    ].join("\n"),
  );
  process.exit(1);
}

const adapter = prodigiAdapter({
  apiKey: key,
  baseUrl,
  items: { "SMOKE-1": { sku, asset } },
  shippingMethod: "Budget",
});

const address: OrderAddress = {
  name: "Sandbox Tester",
  line1: "1 Test Street",
  town: "Leeds",
  postcode: "LS1 1AA",
  country: "GB",
  email: process.env.SMOKE_EMAIL ?? "sandbox@example.com",
};

const orderId = `smoke-${Date.now()}`;
const step = (label: string, value: unknown) => console.log(`\n${label}\n${JSON.stringify(value, null, 2)}`);

console.log(`endpoint   ${baseUrl}`);
console.log(`order      ${orderId}`);
console.log(`sku        ${sku}`);

const quote = await adapter.quote({ lines: [{ supplierSku: "SMOKE-1", quantity: 1 }], address });
step("1. quote", quote);
if (!quote.ok) {
  console.error("\nStopped: the quote has to work before an order is placed.");
  process.exit(2);
}

const placed = await adapter.place({ orderId, lines: [{ supplierSku: "SMOKE-1", quantity: 1 }], address });
step("2. placed", placed);
if (!placed.ok) {
  console.error("\nStopped: Prodigi refused the order, and said why above.");
  process.exit(3);
}

const tracking = await adapter.tracking(placed.supplierReference);
step("3. status", tracking);

console.log(
  [
    "",
    "What just happened: a sandbox order exists at Prodigi with no real money and no parcel.",
    "A live key in PRODIGI_API_KEY would have printed and posted the same order.",
    "Nothing in this shop was changed by this script.",
  ].join("\n"),
);
