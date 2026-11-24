# Where the products come from

This is the sourcing half of the store: the places that will actually hand you a
CSV of products, what is in that file, and what it costs you in money and in
work. The catalogue in `catalogue/` is built from one such file.

**Read this first.** The sample catalogue ships with twelve invented products
and generated placeholder images. No supplier account was used, and none of
those products, prices or pictures are real stock. The pipeline is real; the
data in it is a demonstration.

---

## The shortlist

| Source | What it is | What the feed gives you | Format | Rough cost | Where it hurts |
| --- | --- | --- | --- | --- | --- |
| **Aosom B2B** | Wholesale/dropship arm of a large home, garden and pet supplier. The usual first call for UK homeware stores. | Product name, long description, trade and RRP prices, stock, image URLs, category path, sometimes EAN/MPN | Live product data feed once an account is approved; CSV/XML exports in the portal | Free account, per-order trade pricing, minimum order value on some lines | Stock is per-account and changes hourly, so a nightly CSV goes stale. Shipping is pallet-ish for big items — check carriage before pricing. |
| **BigBuy** | European wholesaler with a dropship programme; 400k+ SKUs, no minimum order. | SKU, name in several languages, description, images, net and RRP price, stock by warehouse, EAN, weight | CSV, XML, FTP drop, REST API | From roughly €69/month for the dropship plan, plus per-order costs | Descriptions are machine-ish and shared with every other BigBuy reseller. Net prices need VAT and your margin added. |
| **Syncee** | A marketplace of suppliers rather than a supplier: you import a catalogue, they keep it in sync. | Whole product catalogues including price, stock, images, variants | CSV/XML import, Shopify/WooCommerce apps | From about $29–40/month | Quality varies supplier by supplier because you are buying from a directory, not a warehouse. Sync is one-directional unless you configure it. |
| **Spocket** | US/EU suppliers aimed at Shopify stores. | Product data with supplier-set shipping times and prices, plus invoicing on your own branding | App import; CSV export on higher tiers | From about $39.99/month | Returns are handled by each supplier, so your returns policy is only as good as the worst one. Selection skews US. |
| **Avasam** (UK) | UK dropshipper with a large catalogue across home, garden, pet and baby. | Full product data, stock, images, and a Shopify-compatible feed | CSV export, feed URL, bulk export | Free to browse, per-order pricing | Feeds are large; you will want to filter to a category rather than import 30,000 rows. |
| **Dropship For You** | UK supplier feed split into two files: products and stock. | Products file: ID/SKU, name, description, price, images. Stock file: `STOCK` as `instock`/`outofstock`, `QTY` as `1`/`0` | CSV, keyed by ID or SKU | Per-order, no monthly fee on the basic route | Two files means two imports. Stock is binary-ish (`1`/`0`), so "low stock" does not exist. |
| **Something Different (SDW Connect)** | UK wholesaler for gift and homeware, no minimum order and no fee. | Catalogue CSV/XML with descriptions, prices, stock, images | CSV/XML | No subscription, per-order pricing | Gift-led ranges, so seasonal — a January catalogue is not a June one. |
| **GoDropship** | UK-warehoused goods (largely China-sourced) with UK delivery times. | CSV catalogues with prices, stock, images | CSV | Per-order | Product quality is inconsistent; order a sample before you list a range. |
| **Matterhorn** | Wholesale feed aimed at resellers wanting net prices. | Product data, net wholesale prices, stock | XML or CSV, refreshed roughly every two hours | Per-order, account required | Net prices: you must add VAT and set retail yourself. Fast refresh only helps if you re-import as often. |
| **DSers / CJdropshipping** | AliExpress-style sourcing with bulk order tooling. | Product data, variants, stock, shipping costs per method | App + CSV | Free tier, per-order | The same product is on AliExpress at a lower price, visibly. This is the "indistinguishable from the crowd" problem in its purest form. |
| **Faire** | Wholesale marketplace for independent retailers, not dropship. | Linesheets and product data for stock you hold | CSV export of order history; API on request | Free to join, 60-day payment terms | You buy inventory up front. Only sane once you know what sells. |

Prices and tiers move; treat the cost column as an order of magnitude and check
the supplier's page before you sign anything.

---

## What the importer expects

`src/importProducts.ts` has column maps for four shapes and falls back to a
generic one, matching headers regardless of case, spaces or punctuation:

| Field | What it becomes | Common supplier header names |
| --- | --- | --- |
| `title` | product title | `Product Name`, `Title`, `Name`, `Product Title` |
| `description` | page copy and feed description | `Product Description`, `Description`, `Body (HTML)` |
| `price` | selling price, parsed from `£49.99`, `1.299,00 €` or `49.99 GBP` | `RRP`, `Price`, `Variant Price` |
| `compareAt` | struck-through "was" price | `Compare At Price`, `List Price`, `MSRP` |
| `stock` / `availability` | stock number, or in/out of stock from words or `1`/`0` | `Stock`, `Qty`, `Stock Status`, `Availability` |
| `image` | image URLs (comma, semicolon or pipe separated) | `Image URL`, `Image Src`, `image_link` |
| `brand` | brand, falling back to the default | `Brand`, `Vendor`, `Manufacturer` |
| `category` | first segment of a category path | `Category`, `Product Type`, `Type` |
| `gtin` / `mpn` | identifiers a feed and an agent both need | `EAN`, `Barcode`, `GTIN`, `MPN` |
| `sku` | the variant SKU | `SKU`, `Variant SKU`, `Product Code` |
| `slug` | the page URL | `Handle`, `Slug`, `URL Key` |

Every row that cannot become a product is reported by line number with the
reason, and rows that had to be repaired (no image, no identifier, duplicate
slug) are reported too. Nothing is dropped in silence.

```bash
cd commerce
npm run catalogue                      # builds catalogue/dist from catalogue/products.csv
npm run catalogue -- ~/aosom-feed.csv  # or any other supplier file
npm run serve:catalogue                # http://localhost:4300
```

---

## The six checks that matter more than the import

1. **Prices.** Trade feeds give net or trade prices. UK retail prices must
   include VAT (20%) and your margin. Do not publish a net price by accident.
2. **Stock.** A CSV is a photograph. If the supplier cannot give you a stock
   feed or an API, expect to oversell, and write a policy for what happens when
   you do.
3. **Identifiers.** Most trade feeds have no GTIN. Without one, Google feeds get
   weaker matching and AI shopping agents cannot confirm the product is the same
   thing they know. Add the EAN when the supplier has it.
4. **Images.** The supplier owns the photography. Check the licence covers your
   own domain, and never hotlink a supplier CDN you do not control.
5. **Copy.** Reusing supplier descriptions verbatim is duplicate content shared
   with every other reseller, and it reads like a specification sheet. Rewrite
   the first paragraph at minimum — the title, the first sentence and the
   "who it is for" line.
6. **Compliance.** UK: distance-selling cancellation rights, and a returns
   policy that is honest about who pays postage. EU: GPSR (2024) wants a
   manufacturer or responsible person named on the listing, and EPR registration
   for packaging. None of that is optional just because the supplier ships it.

---

## Feeding the shop back out

`src/exportFeed.ts` writes a Google Merchant Centre feed from the same
catalogue: one row per product, `price` as a decimal string with the currency
(`"49.99 GBP"`), `availability` as `in_stock` / `out_of_stock` / `backorder`,
descriptions stripped of HTML, `condition` set to `new`, and GTIN/MPN passed
through when the supplier supplied them. Products with no image, or a
description too short to be useful, are listed as rejected with the reason
rather than silently omitted.

The same run also writes `products.json` (what an app or a front end reads),
`llms.txt` (what an answer engine reads), `sitemap.xml` and `robots.txt`.

Images in the sample are SVG placeholders generated at build time. Swapping in
real photography means replacing the `images` array after import — the rest of
the pipeline does not care where the URL points.
