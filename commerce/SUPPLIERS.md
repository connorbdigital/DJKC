# Where the products come from

This is the sourcing half of the store: the places that will actually hand you a
CSV of products, the marketplace you list on when you already hold the stock,
what each one costs, and the checks that decide whether a feed is safe to
publish. The catalogue in `catalogue/` is built from one such file.

**Two things to hold on to.**

1. **A supplier feed is not the only way in.** The Range, Wayfair, eBay, Amazon
   and OnBuy are places you *sell*, not places you *source*. You send them
   products; they do not send you a catalogue. If you were thinking of "The Range
   dropship", it is a marketplace application, not a CSV — see
   [Marketplaces you list on](#marketplaces-you-list-on-the-other-direction).
2. **The sample catalogue is invented.** Twelve demo products, generated
   placeholder images, no supplier account. The pipeline is real; the stock is not.

---

## Feeds you import

Ordered by how likely they are to be the right first call for a UK homeware and
garden shop. Costs were checked in November 2026 and move; confirm on the page
before you sign anything.

| Source | What it is | What the feed gives you | Format | Rough cost | Where it hurts |
| --- | --- | --- | --- | --- | --- |
| [Aosom B2B](https://www.aosom.co.uk/page/business) | Wholesale/dropship arm of the Homcom, Outsunny and Pawhut group — home, garden, pet, office. UK and Ireland warehouses. | Live product data feed: product info, price and stock, with tiered trade discounts; product IDs, descriptions and image URLs | Live feed in the business portal; CSV/XML exports | Free trade account, per-order trade pricing, tiered discount | Big items are pallet-ish — check carriage before pricing. Stock changes hourly, so a nightly CSV goes stale. |
| [BigBuy](https://www.bigbuy.eu) | European wholesaler and dropshipper, 400k+ SKUs, no minimum order. | SKU, multi-language descriptions, images, net and RRP price, stock by warehouse, EAN, weight | CSV, XML, FTP drop, REST API | From about €69/month plus per-order costs | Descriptions are machine-ish and shared with every other reseller. Net prices need VAT and your margin added. |
| [Avasam](https://www.avasam.com) | London-registered dropship platform over a vetted UK/US supplier network. | Products with stock and price, auto stock and price sync on paid plans, plain packaging with no invoice | Native apps + CSV export | Free plan; paid from £24.99 + VAT/month ([pricing](https://s2.avasam.com/pricing/)), less annually | Supplier quality varies; you are buying a directory with fulfilment attached. |
| [Syncee](https://syncee.com) | A marketplace of suppliers that keeps a catalogue in sync. | Whole catalogues: price, stock, images, variants | CSV/XML import, Shopify/Woo apps | From about $29/month | You are buying a directory, so quality is per supplier. Sync is one-directional unless configured. |
| [Spocket](https://www.spocket.co) | Curated US/EU suppliers aimed at Shopify. | Product data, supplier-set shipping times, branded invoicing | App; CSV on higher tiers | From about $39.99/month | Returns are per supplier, so your policy is only as good as the worst one. Selection skews US. |
| [AppScenic](https://appscenic.com) | Supplier aggregator with automation and higher-ticket lines. | Product data, stock sync, auto-ordering, tracking | App integrations | $0 / $39 / $79 / $99 per month | Another directory: the supplier behind each listing is the real variable. |
| [Dropship For You](https://www.dropshipforyou.co.uk/datafeed-downloads/) | UK supplier with **two** publicly documented feeds: products and stock. | Products feed: ID, SKU, name, description, price, images. Stock feed: `ID`, `SKU`, `STOCK` (`instock`/`outofstock`), `QTY` (`1`/`0`) | CSV over HTTP, keyed to your account email | No subscription, per-order | Two files means two imports. Binary stock, so "low stock" does not exist. |
| [Something Different (SDW Connect)](https://www.somethingdifferentdropship.co.uk) | Swansea giftware and homeware wholesaler, trading since 1999. | Catalogue with stock, price, images; same-day dispatch on orders before 1pm | CSV/XML via SDW Connect | No minimum order, no subscription | Gift-led and seasonal; a January catalogue is not a June one. |
| [GoDropship](https://www.godropship.co.uk) | UK-warehoused general goods, same-day dispatch before 9am. | Downloadable catalogue CSV, images, stock, UK delivery in 2–7 days | CSV | Free to join, per-order | Quality is inconsistent; order a sample before listing a range. |
| [AW Dropship (Ancient Wisdom)](https://www.ancientwisdom.biz) | Sheffield giftware and home-fragrance wholesaler since 1995. | Product codes, structured categories, trade prices shown after login | Apps + CSV, or manual ordering | Free trade account, per-order, small-order charge | Prices are login-only, so budgeting starts after approval. |
| [Costway UK](https://www.costway.co.uk/dropship-with-costway) | Own-brand home, garden and furniture with UK warehouses. | Product data, stock, tiers by volume | Catalogue + dropship portal | No joining fee; 10–12% discount by sales level | Own brand only, so no differentiation beyond price and service. |
| [Matterhorn](https://matterhorn-wholesale.com/?str=integrate) | European fashion wholesaler, 30k+ models, 14 languages. | XML, CSV, XLS files refreshed **every two hours**, plus a REST API and a Shopify app | XML/CSV/API | Free account, per-order | Clothing, not homeware — useful only if the range moves that way. |
| [Pound Wholesale](https://www.poundwholesale.co.uk) | Blackburn wholesaler: household, stationery, toys, pet, DIY. | Trade catalogue; dropship on request | Trade portal, CSV on request | Trade account, case/pack quantities | Case quantities, so not true single-unit dropship on every line. |
| [Prodigi](https://www.prodigi.com) | Print on demand: wall art, apparel, homeware printed in-house in the UK. | Product catalogue with variants, print areas, prices | Free API, CSV importer, store apps | Free, no subscription, pay per item | Made to order, so no stock feed and no returns on printed goods. |
| [Dropora](https://dropora.uk) | UK dropshipper with a large catalogue and blind dispatch. | 14k+ products, live stock, CSV/JSON/XML export, Shopify push | CSV/JSON/XML, API | Free reseller account, per-order | Newer operation — check reviews and order a sample. |
| [CJdropshipping](https://www.cjdropshipping.com) / [DSers](https://www.dsers.com) | AliExpress-style sourcing with bulk ordering tools. | Product data, variants, stock, shipping cost per method | App + CSV | Free tier, per-order | The same product is on AliExpress cheaper and visibly. |

### Directories, when you want the long tail

| Source | What it gives you |
| --- | --- |
| [The Wholesaler UK](https://www.thewholesaler.co.uk) | A vetted directory of UK dropshippers by category, with contact details and what each one does |
| [eSources](https://www.esources.co.uk) | UK wholesale directory, free tier |
| [SaleHoo](https://www.salehoo.com) | Supplier directory plus a dropship app; paid |
| [Faire](https://www.faire.com) | Wholesale marketplace for independent retailers. You buy stock up front, with 60-day terms — the opposite of dropship |

---

## Marketplaces you list on (the other direction)

Here you send a catalogue *out* and fulfil the order yourself. They are not
sources of product data, and none of them will fill your shop. What they do offer
is traffic you cannot buy.

| Where | What it is | Why you might | What it costs you |
| --- | --- | --- | --- |
| [The Range Marketplace](https://marketplace.therange.co.uk/) | The Range's third-party marketplace, now on Mirakl. Around 200m site visits a year, and the marketplace is said to drive nearly half of its online sales. You list, you fulfil, you get paid. | Reach without ads, and no setup or subscription fee — commission on sale only | Your products sit next to The Range's own, at whatever price they set. You own fulfilment and returns. |
| [OnBuy](https://www.onbuy.com) | UK marketplace with lower seller fees than Amazon | Cheap reach in the UK | You fulfil; fee per sale |
| [eBay](https://www.ebay.co.uk) / [Amazon](https://sell.amazon.co.uk) | The two default channels | Demand exists | Fees, price competition, and rules that change without asking |
| [Wayfair](https://partners.wayfair.com) | Furniture and home marketplace, UK and US | Home and garden is exactly its category | Application and catalogue standards; you ship |
| [TikTok Shop](https://shop.tiktok.com) | Social commerce | Discovery for demonstrable products | Content workload, not a feed problem |

**How this differs from a feed in practice:** a marketplace sends you an order and
expects a dispatch confirmation; a supplier feed sends you products and expects
you to sell them. The catalogue builder in this package is for the second case.
For the first, the feed you need is an *outbound* one — and `exportFeed.ts`
already writes one that will pass Google's checks, which is close to what most
marketplaces want.

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

## How to vet a supplier in ten minutes

Ask these before you list a single product. The answers decide whether the shop
is a business or a hobby with a Stripe account.

1. **Dispatch cut-off and carrier.** "Same day before 1pm, Royal Mail Tracked 48"
   is a promise you can put on a product page. "2–5 days" is not.
2. **Who pays the return, and where does it go?** If the customer posts it back to
   the supplier, your returns policy has to say so, and it will be worse than your
   competitors'.
3. **Is the parcel blind?** No supplier invoice, no supplier branding, no price.
4. **How fresh is stock, and how do you get it?** A feed URL or an API, or a file
   you download daily. If the answer is "log in and look", you will oversell.
5. **Are there GTINs?** If not, the Google feed matching and AI-agent lookup both
   get weaker — and `SUPPLIERS.md` above tells you which suppliers supply them.
6. **Who owns the images?** A licence to use them on your own domain, in writing.
7. **Minimum order, small-order charges, and carriage.** A £1 small-order charge
   on a £9 item is a 11% margin cut before you have priced anything.
8. **GPSR / EPR.** Selling into the EU needs a named responsible person and
   packaging registration. Ask now, not after the first complaint.

---

## The six checks that matter more than the import

1. **Prices.** Trade feeds give net or trade prices. UK retail prices include VAT
   (20%). Add it and your margin deliberately; do not publish a net price by
   accident.
2. **Stock.** A CSV is a photograph. If there is no stock feed or API, expect to
   oversell, and write the policy for when you do.
3. **Identifiers.** Most trade feeds have no GTIN. Add the EAN wherever the
   supplier has it.
4. **Images.** Never hotlink a supplier CDN you do not control; never assume the
   licence covers your domain.
5. **Copy.** Supplier descriptions are duplicate content shared with every other
   reseller, and they read like a spec sheet. Rewrite the title, the first
   paragraph and the "who it is for" line at minimum.
6. **Compliance.** UK distance-selling rights and an honest returns policy; EU
   GPSR and EPR. None of it is optional because the supplier ships the parcel.

---

## Feeding the shop back out

`src/exportFeed.ts` writes a Google Merchant Centre feed from the same catalogue:
one row per product, `price` as a decimal string with currency (`"49.99 GBP"`),
`availability` as `in_stock` / `out_of_stock` / `backorder`, HTML stripped from
descriptions, `condition` set to `new`, GTIN and MPN passed through when the
supplier supplied them. Products with no image, or a description too short to be
useful, are listed as rejected with the reason rather than silently omitted.

The same run also writes `products.json` (for an app or a front end), `llms.txt`
(for answer engines), `sitemap.xml` and `robots.txt`.

Images in the sample are SVG placeholders generated at build time. Swapping in
real photography means replacing the `images` array after import — nothing else in
the pipeline cares where the URL points.
