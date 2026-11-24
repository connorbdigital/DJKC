/**
 * Builds a static product catalogue from a supplier CSV.
 *
 *   npm run catalogue            # reads catalogue/products.csv
 *   npm run catalogue -- other.csv
 *
 * Output (in catalogue/dist): an index page, one page per product, the images,
 * products.json, a Google Merchant feed, llms.txt, sitemap.xml and robots.txt.
 * Nothing here needs a server to render; the pages are the catalogue.
 *
 * The sample images are generated placeholders on purpose: no supplier
 * credentials were used to fetch anything, and inventing product photography
 * would be a lie in the shape of an asset.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { importCsv, IMPORT_CHECKS } from "../src/importProducts";
import { validateProduct, availability, priceFrom } from "../src/catalog";
import { format } from "../src/money";
import { googleFeed, productsJson, sitemap } from "../src/exportFeed";
import { breadcrumbJsonLd, llmsTxt, pageMeta, productJsonLd } from "../src/seo";

const SITE = "https://shop.example";
const SITE_NAME = "Harbour & Fen";
const SOURCE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("catalogue/products.csv");
const OUT = path.resolve("catalogue/dist");

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PALETTE = ["#f5b8c9", "#c7d8c4", "#d9c8b4", "#b8c9d9", "#e0c7a8", "#cbb8d9"];
const colourFor = (slug: string) => {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return PALETTE[hash % PALETTE.length]!;
};

/** A deterministic placeholder illustration: a soft wash with the initials. */
const placeholderSvg = (title: string, slug: string): string => {
  const wash = colourFor(slug);
  const initials = title
    .split(/\s+/)
    .filter((word) => /^[a-z]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${escape(title)} placeholder illustration">
  <rect width="600" height="600" fill="${wash}"/>
  <circle cx="300" cy="270" r="150" fill="#0b0b0f" opacity="0.08"/>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="120" fill="#0b0b0f" opacity="0.55">${initials}</text>
  <text x="300" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#0b0b0f" opacity="0.45">placeholder image</text>
</svg>
`;
};

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; background: #faf7f4; color: #14100e; }
a { color: inherit; }
header.site, main, footer.site { max-width: 1080px; margin: 0 auto; padding: 0 1.25rem; }
header.site { padding-top: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #e4dbd2; }
header.site .eyebrow { letter-spacing: .14em; text-transform: uppercase; font-size: .7rem; color: #8a7a6c; margin: 0 0 .35rem; }
header.site h1 { font: 600 clamp(1.7rem, 4vw, 2.6rem)/1.1 Georgia, serif; margin: 0; }
header.site p.lede { color: #5d4f45; max-width: 46rem; }
nav.crumbs { font-size: .8rem; color: #7a6b60; padding: .8rem 0 0; }
.categories { display: flex; flex-wrap: wrap; gap: .4rem; padding: 1rem 0; }
.categories a { border: 1px solid #e4dbd2; border-radius: 999px; padding: .28rem .7rem; font-size: .8rem; text-decoration: none; background: #fff; }
.categories a:hover { border-color: #14100e; }
section.category { margin: 1.5rem 0 2.5rem; }
section.category h2 { font: 600 1.25rem/1.2 Georgia, serif; margin: 0 0 .75rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1.1rem; }
.card { background: #fff; border: 1px solid #ece3da; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
.card img { width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; display: block; background: #f2ece5; flex: none; }
.card .body { padding: .8rem .9rem 1rem; display: flex; flex-direction: column; gap: .35rem; flex: 1; }
.card .brand { font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: #8a7a6c; }
.card a.title { font-weight: 600; text-decoration: none; line-height: 1.3; }
.card a.title:hover { text-decoration: underline; }
.card .price { font-weight: 600; margin-top: auto; }
.card .stock { font-size: .78rem; color: #2f7d4f; }
.card .stock.out { color: #a33; }
.product { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2rem; padding: 1.5rem 0 3rem; }
.product img { width: 100%; border-radius: 16px; border: 1px solid #ece3da; }
.product h1 { font: 600 clamp(1.5rem, 3vw, 2.2rem)/1.15 Georgia, serif; margin: .2rem 0 .4rem; }
.product .price { font-size: 1.4rem; font-weight: 600; margin: .6rem 0; }
.product .buy { display: inline-block; background: #14100e; color: #fff; border-radius: 999px; padding: .6rem 1.3rem; text-decoration: none; font-weight: 600; }
.product .buy:hover { background: #3d3129; }
table.specs { border-collapse: collapse; width: 100%; margin-top: 1rem; font-size: .9rem; }
table.specs th, table.specs td { text-align: left; padding: .45rem .2rem; border-bottom: 1px solid #ece3da; vertical-align: top; }
table.specs th { color: #7a6b60; font-weight: 500; width: 40%; }
.policy { margin-top: 1.2rem; font-size: .9rem; color: #5d4f45; }
footer.site { padding: 2rem 1.25rem 3rem; border-top: 1px solid #e4dbd2; color: #7a6b60; font-size: .82rem; }
footer.site p { margin: .3rem 0; }
@media (max-width: 720px) { .product { grid-template-columns: 1fr; gap: 1.2rem; } }
`;

const layout = (options: { title: string; description: string; body: string; jsonLd?: object[]; crumbs?: { name: string; url: string }[] }): string => `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(options.title)}</title>
<meta name="description" content="${escape(options.description)}">
<link rel="canonical" href="${SITE}/">
<meta property="og:title" content="${escape(options.title)}">
<meta property="og:description" content="${escape(options.description)}">
<meta property="og:type" content="website">
${(options.jsonLd ?? []).map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`).join("\n")}
<style>${CSS}</style>
</head>
<body>
<header class="site">
  <p class="eyebrow">${SITE_NAME} — catalogue</p>
  <h1>${escape(options.title)}</h1>
  <p class="lede">${escape(options.description)}</p>
  ${(options.crumbs ?? []).length ? `<nav class="crumbs">${options.crumbs!.map((crumb, index) => `${index ? " › " : ""}<a href="${crumb.url}">${escape(crumb.name)}</a>`).join("")}</nav>` : ""}
</header>
<main>
${options.body}
</main>
<footer class="site">
  <p>Static catalogue built from a supplier CSV. Prices in pounds and include VAT. Images are generated placeholders, not product photography.</p>
  <p>There is no checkout wired to this page: it is a catalogue, and every product links back to the supplier's data. ${IMPORT_CHECKS.length} checks apply to any feed like this one.</p>
</footer>
</body>
</html>
`;

const bytes = (value: string) => new TextEncoder().encode(value).length;

const run = async () => {
  const csv = await readFile(SOURCE, "utf8");
  const imported = importCsv(csv, { defaultBrand: SITE_NAME, currency: "GBP", returnDays: 30 });
  const rows = imported.stats.rows;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "assets"), { recursive: true });
  await mkdir(path.join(OUT, "product"), { recursive: true });

  /* A CSV cannot supply photography. Generate an honest placeholder instead. */
  const products = imported.products.map((product) => {
    const file = `${product.slug}.svg`;
    return {
      ...product,
      images: [{ url: `assets/${file}`, alt: `${product.title} — placeholder illustration` }],
      placeholder: placeholderSvg(product.title, product.slug),
      imageFile: file,
    };
  });

  for (const product of products) {
    await writeFile(path.join(OUT, "assets", product.imageFile), product.placeholder, "utf8");
  }

  const problems = products.flatMap((product) =>
    validateProduct({ ...product, images: product.images.map((image) => ({ url: `${SITE}/${image.url}`, alt: image.alt })) }).map(
      (issue) => `${product.slug}: ${issue.field} — ${issue.problem}`
    )
  );

  const categories = [...new Set(products.map((product) => product.category))].sort();

  const cards = (list: typeof products) =>
    list
      .map((product) => {
        const price = priceFrom(product);
        const inStock = product.variants.some((variant) => availability(variant) === "InStock");
        return `<article class="card">
  <a href="product/${product.slug}.html"><img src="${product.images[0]!.url}" alt="${escape(product.images[0]!.alt)}" width="600" height="600" loading="lazy"></a>
  <div class="body">
    <span class="brand">${escape(product.brand)}</span>
    <a class="title" href="product/${product.slug}.html">${escape(product.title)}</a>
    <span class="price">${price ? format(price) : "—"}</span>
    <span class="stock${inStock ? "" : " out"}">${inStock ? "In stock" : "Out of stock"}</span>
  </div>
</article>`;
      })
      .join("\n");

  const indexBody = [
    `<div class="categories">${categories.map((category) => `<a href="#${category.toLowerCase()}">${escape(category)}</a>`).join("")}</div>`,
    ...categories.map(
      (category) => `<section class="category" id="${category.toLowerCase()}">
  <h2>${escape(category)}</h2>
  <div class="grid">
${cards(products.filter((product) => product.category === category))}
  </div>
</section>`
    ),
  ].join("\n");

  const indexDescription = `${products.length} household and garden products from ${SITE_NAME}, prices in pounds including VAT, free returns within 30 days.`;
  await writeFile(
    path.join(OUT, "index.html"),
    layout({
      title: `${SITE_NAME} — catalogue`,
      description: indexDescription,
      body: indexBody,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${SITE}/product/${product.slug}.html`,
            name: product.title,
          })),
        },
      ],
    }),
    "utf8"
  );

  for (const product of products) {
    const variant = product.variants[0]!;
    const price = priceFrom(product) ?? variant.price;
    const meta = pageMeta(product, format(price));
    const inStock = availability(variant) === "InStock";
    const body = `<article class="product">
  <div><img src="../${product.images[0]!.url}" alt="${escape(product.images[0]!.alt)}" width="600" height="600"></div>
  <div>
    <span class="brand">${escape(product.brand)} · ${escape(product.category)}</span>
    <h1>${escape(product.title)}</h1>
    <p class="price">${format(price)} <span class="stock${inStock ? "" : " out"}">${inStock ? "In stock" : "Out of stock"}</span></p>
    <p>${escape(product.description)}</p>
    <table class="specs">
      <tr><th>SKU</th><td>${escape(variant.sku)}</td></tr>
      <tr><th>Identifier</th><td>${variant.gtin ? `GTIN ${escape(variant.gtin)}` : variant.mpn ? `MPN ${escape(variant.mpn)}` : "None supplied by the feed"}</td></tr>
      <tr><th>Category</th><td>${escape(product.category)}</td></tr>
      <tr><th>Stock</th><td>${variant.stock}</td></tr>
      <tr><th>Returns</th><td>${escape(product.returnPolicy.summary)}</td></tr>
    </table>
    <p class="policy">This page is a catalogue: prices and stock come from a supplier file and go stale. The checkout belongs to your shop, not here.</p>
    <p><a class="buy" href="../index.html#${product.category.toLowerCase()}">Back to the catalogue</a></p>
  </div>
</article>`;

    await writeFile(
      path.join(OUT, "product", `${product.slug}.html`),
      layout({
        title: meta.title,
        description: meta.description,
        body,
        jsonLd: [
          productJsonLd(
            { ...product, images: product.images.map((image) => ({ url: `${SITE}/${image.url}`, alt: image.alt })) },
            variant,
            { url: `${SITE}/product/${product.slug}.html`, siteName: SITE_NAME }
          ),
          breadcrumbJsonLd([
            { name: "Catalogue", url: `${SITE}/` },
            { name: product.category, url: `${SITE}/#${product.category.toLowerCase()}` },
            { name: product.title, url: `${SITE}/product/${product.slug}.html` },
          ]),
        ],
        crumbs: [
          { name: "Catalogue", url: "../index.html" },
          { name: product.category, url: `../index.html#${product.category.toLowerCase()}` },
          { name: product.title, url: `../product/${product.slug}.html` },
        ],
      }),
      "utf8"
    );
  }

  const feed = googleFeed(
    products.map((product) => ({
      ...product,
      images: product.images.map((image) => ({ url: `${SITE}/${image.url}`, alt: image.alt })),
    })),
    { linkBase: SITE, shipping: "GB::Free delivery:0.00 GBP" }
  );

  await writeFile(path.join(OUT, "google-feed.csv"), feed.csv, "utf8");
  await writeFile(path.join(OUT, "products.json"), productsJson(products, SITE), "utf8");
  await writeFile(
    path.join(OUT, "llms.txt"),
    llmsTxt({
      name: SITE_NAME,
      url: SITE,
      summary: `${products.length} household and garden products, prices in pounds including VAT, free returns within 30 days.`,
      currency: "GBP",
      facts: [
        `Catalogue built on ${rows} supplier rows`,
        "Static pages: no JavaScript required to read prices or descriptions",
        "Prices and stock are a snapshot of a supplier feed",
      ],
      products: products.map((product) => ({
        title: product.title,
        url: `${SITE}/product/${product.slug}.html`,
        price: format(priceFrom(product) ?? product.variants[0]!.price),
      })),
      policies: {
        returns: "Free returns within 30 days",
        delivery: "Free standard delivery, 2–3 working days",
        contact: "hello@harbourandfen.example",
      },
    }),
    "utf8"
  );
  await writeFile(
    path.join(OUT, "sitemap.xml"),
    sitemap([`${SITE}/`, ...products.map((product) => `${SITE}/product/${product.slug}.html`)]),
    "utf8"
  );
  await writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n\n# Answer engines: ${SITE}/llms.txt\n`, "utf8");

  const totalBytes =
    products.reduce((sum, product) => sum + bytes(product.placeholder), 0) +
    bytes(indexBody) +
    bytes(CSS) +
    products.reduce((sum, product) => sum + bytes(product.description), 0);
  console.log(`source        ${path.relative(process.cwd(), SOURCE)}`);
  console.log(`profile       ${imported.profile.label} (${imported.profile.id})`);
  console.log(`rows          ${rows} read, ${imported.stats.imported} imported, ${imported.stats.skipped} skipped, ${imported.stats.repaired} repaired`);
  const byProblem = new Map<string, number>();
  for (const issue of imported.issues) {
    const key = `${issue.action}: ${issue.problem}`;
    byProblem.set(key, (byProblem.get(key) ?? 0) + 1);
  }
  for (const [problem, count] of [...byProblem].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)} × ${problem}`);
  }
  console.log(`categories    ${categories.join(", ")}`);
  console.log(`pages         ${products.length + 1} html, ${products.length} svg placeholders`);
  console.log(`feed          google-feed.csv ${feed.rows.length} rows, ${feed.rejected.length} rejected`);
  for (const rejection of feed.rejected) console.log(`  rejected ${rejection.id}: ${rejection.reason}`);
  console.log(`issues        ${problems.length === 0 ? "none" : `${problems.length} validation notes`}`);
  for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
  console.log(`approx bytes  ${Math.round(totalBytes / 1024)} kB of images, page shell and CSS`);
  console.log(`output        ${path.relative(process.cwd(), OUT)}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
