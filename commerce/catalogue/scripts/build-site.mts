/**
 * The shop, built from a supplier CSV.
 *
 *   npm run site                    # catalogue/products.csv → catalogue/dist
 *   npm run site -- ~/aosom.csv     # any supplier file
 *
 * Produces a homepage, twelve department pages, one page per product, a shop
 * index, a client-side search page, three policy pages, the structured data for
 * all of it, a Merchant feed, products.json, llms.txt, llms-full.txt, a sitemap
 * and robots.txt. Static HTML: the crawler, the answer engine and the phone all
 * get the same finished page.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { importCsv, IMPORT_CHECKS } from "../../src/importProducts";
import { availability, listPrice, validateProduct, type Product } from "../../src/catalog";
import { format, money } from "../../src/money";
import { googleFeed, productsJson, sitemap } from "../../src/exportFeed";
import { breadcrumbJsonLd, llmsTxt, pageMeta, productJsonLd } from "../../src/seo";
import { buildIndex } from "../../src/search";
import {
  countIn,
  deliveryFor,
  deliveryLine,
  departmentFaqs,
  departmentFor,
  descriptionFor,
  groupByDepartment,
  onOffer,
  productFacts,
  relatedProducts,
  savingPercent,
  shopFaqs,
  stockLabel,
  titleFor,
} from "../../src/siteModel";
import { BRAND, DEPARTMENTS, SEARCH_SYNONYMS } from "../site";
import {
  breadcrumbs,
  escapeHtml,
  faqBlock,
  factsTable,
  productCard,
  renderPage,
  sectionHead,
  type NavItem,
} from "../render";

const SOURCE = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("catalogue/products.csv");
const OUT = path.resolve("catalogue/dist");
/** Generated, imported by api/checkout.js. */
const LIB = path.resolve("lib");
const UPDATED = new Date().toISOString().slice(0, 10);
const abs = (url: string) => `${BRAND.url}/${url.replace(/^\/+/, "")}`;

const PALETTE = ["#f5c9d4", "#c9d8c4", "#ded0bd", "#c2d1df", "#e3cdb4", "#d2c4df", "#cfd8cf", "#e6d6c2"];
const colourFor = (slug: string) => {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return PALETTE[hash % PALETTE.length]!;
};

const placeholderSvg = (title: string, slug: string): string => {
  const wash = colourFor(slug);
  const initials = title
    .split(/\s+/)
    .filter((word) => /^[a-z]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${escapeHtml(title)} placeholder illustration">
  <rect width="600" height="600" fill="${wash}"/>
  <circle cx="300" cy="268" r="146" fill="#15100d" opacity="0.07"/>
  <text x="300" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="118" fill="#15100d" opacity="0.52">${initials}</text>
  <text x="300" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="19" fill="#15100d" opacity="0.42">placeholder image</text>
</svg>
`;
};

const ogSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${escapeHtml(BRAND.name)}">
  <rect width="1200" height="630" fill="#fdfaf7"/>
  <rect x="0" y="0" width="1200" height="14" fill="#e8607f"/>
  <text x="70" y="210" font-family="Georgia, serif" font-size="86" fill="#15100d">${escapeHtml(BRAND.name)}</text>
  <text x="70" y="290" font-family="system-ui, sans-serif" font-size="34" fill="#4a3f38">${escapeHtml(BRAND.tagline)}</text>
  <text x="70" y="380" font-family="system-ui, sans-serif" font-size="26" fill="#6f6259">Free delivery over £40 · 30-day returns · prices include VAT</text>
  <rect x="70" y="430" width="380" height="60" rx="30" fill="#15100d"/>
  <text x="260" y="469" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="#ffffff">Shop the catalogue</text>
</svg>
`;

interface Ctx {
  nav: NavItem[];
  products: Product[];
  groups: ReturnType<typeof groupByDepartment>;
}

const navFor = (groups: Ctx["groups"], activeHref?: string): NavItem[] => [
  ...groups
    .filter((group) => group.products.length > 0)
    .map((group) => ({
      label: group.department.label,
      href: `department/${group.department.id}.html`,
      count: group.products.length,
      current: activeHref === `department/${group.department.id}.html`,
    })),
  { label: "All products", href: "shop.html", current: activeHref === "shop.html" },
  { label: "Delivery & returns", href: "pages/delivery-returns.html", current: activeHref === "pages/delivery-returns.html" },
];

const organisation = () => ({
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  name: BRAND.name,
  legalName: BRAND.legalName,
  url: BRAND.url,
  description: BRAND.description,
  email: BRAND.email,
  telephone: BRAND.phone,
  logo: { "@type": "ImageObject", url: abs("assets/og.svg") },
  image: abs("assets/og.svg"),
  currenciesAccepted: "GBP",
  paymentAccepted: "Visa, Mastercard, American Express, Apple Pay, PayPal",
  areaServed: { "@type": "Country", name: "United Kingdom" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: BRAND.email,
    telephone: BRAND.phone,
    availableLanguage: "English",
  },
});

const webSite = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: BRAND.name,
  url: BRAND.url,
  inLanguage: "en-GB",
  publisher: { "@type": "Organization", name: BRAND.name, url: BRAND.url },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BRAND.url}/search.html?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

const itemList = (products: Product[], name: string) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name,
  numberOfItems: products.length,
  itemListElement: products.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: abs(`product/${product.slug}.html`),
    name: product.title,
  })),
});

const faqSchema = (faqs: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

const offerSchema = (product: Product) => {
  const variant = product.variants.find((entry) => availability(entry) !== "OutOfStock") ?? product.variants[0]!;
  return productJsonLd(
    { ...product, images: product.images.map((image) => ({ url: abs(image.url), alt: image.alt })) },
    variant,
    {
      url: abs(`product/${product.slug}.html`),
      siteName: BRAND.name,
      shipping: {
        rate: (deliveryFor(listPrice(product)!).minor / 100).toFixed(2),
        minDays: BRAND.delivery.standardDays[0],
        maxDays: BRAND.delivery.standardDays[1],
      },
      priceValidUntil: `${new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)}`,
      specs: product.specs,
    }
  );
};

const run = async () => {
  const csv = await readFile(SOURCE, "utf8");
  const imported = importCsv(csv, { defaultBrand: BRAND.name, currency: "GBP", returnDays: BRAND.returns.days });
  const rows = imported.stats.rows;

  await rm(OUT, { recursive: true, force: true });
  for (const dir of ["assets", "product", "department", "pages"]) await mkdir(path.join(OUT, dir), { recursive: true });

  /* The checkout prices a basket on the server, from a copy of this catalogue that
     is generated here. One file in, two doors out: the shop and the payment
     session cannot disagree about what a mug costs, because they cannot disagree
     about the file. */
  const checkoutCatalogue = imported.products.map((product) => {
    const price = listPrice(product);
    const variant = product.variants[0];
    return {
      /* The id the shop's own buttons carry, so the basket and the checkout use
         one name for a product; the SKU travels alongside for the paperwork. */
      id: product.id,
      sku: variant?.sku ?? product.id,
      name: product.title,
      slug: product.slug,
      priceMinor: price?.amount ?? 0,
      available: variant ? availability(variant) !== "OutOfStock" : false,
      image: `assets/${product.slug}.svg`,
    };
  });
  await mkdir(path.join(LIB), { recursive: true });
  await writeFile(
    path.join(LIB, "catalogue.js"),
    `/* GENERATED by catalogue/scripts/build-site.mts from catalogue/products.csv — do not edit.\n` +
      `   The checkout prices every basket from this list; if a price is wrong here, it is wrong in the CSV. */\n` +
      `export const CATALOGUE = ${JSON.stringify(checkoutCatalogue, null, 2)};\n`,
    "utf8"
  );

  /* Images: a CSV cannot supply photography, so the build invents an honest placeholder. */
  const products = imported.products.map((product) => {
    const file = `${product.slug}.svg`;
    return {
      ...product,
      images: [{ url: `assets/${file}`, alt: `${product.title} — placeholder illustration, not a photograph of the product` }],
    };
  });
  await writeFile(path.join(OUT, "assets", "og.svg"), ogSvg(), "utf8");
  for (const product of products) {
    await writeFile(path.join(OUT, "assets", `${product.slug}.svg`), placeholderSvg(product.title, product.slug), "utf8");
  }

  const groups = groupByDepartment(products);
  const ctx: Ctx = { nav: navFor(groups), products, groups };
  const deals = onOffer(products);
  const cheap = [...products].filter((product) => (listPrice(product)?.amount ?? 0) <= 2500).slice(0, 4);
  const fresh = products.slice(0, 4);
  const faqs = shopFaqs();
  const validation = products.flatMap((product) => validateProduct(product).map((issue) => `${product.slug}: ${issue.field}`));

  const pagesWritten: { url: string; priority: string }[] = [];

  /* ---------------------------------------------------------------- home */
  const heroArt = [products[0], deals[0] ?? products[1], products[2]]
    .filter((product): product is Product => Boolean(product))
    .map((product) => `<img src="${product.images[0]!.url}" alt="${escapeHtml(product.images[0]!.alt)}" width="600" height="600">`)
    .join("");

  const homeBody = `
<section class="hero">
  <div class="wrap">
    <div>
      <h1>Homeware that answers the question before you ask it.</h1>
      <p class="lede">${escapeHtml(BRAND.description)}</p>
      <div class="hero-cta">
        <a class="btn" href="shop.html">Shop all ${products.length} products</a>
        <a class="btn secondary" href="department/home.html">Start with homeware</a>
      </div>
      <p class="hero-note">Free delivery over £40 · 30 days to change your mind · prices include VAT</p>
    </div>
    <div class="hero-art">${heroArt}</div>
  </div>
</section>

<div class="trust"><div class="wrap"><ul>
  ${BRAND.trust.map((line) => `<li><span class="tick" aria-hidden="true">✓</span>${escapeHtml(line)}</li>`).join("\n  ")}
</ul></div></div>

<section class="band" aria-labelledby="depts-heading">
  <div class="wrap">
    ${sectionHead("Shop by department", "Everything we sell, split the way you would actually look for it. The shelves still filling up say so on the tile.", {
      label: "All products",
      href: "shop.html",
    }).replace('id="', 'id="depts-')}
    <div class="depts">
      ${groups
        .map(
          (group) => `<a class="dept${group.products.length ? "" : " soon"}" href="department/${group.department.id}.html">
        <span class="name">${escapeHtml(group.department.label)}</span>
        <span class="count">${
          group.products.length ? `${group.products.length} products` : "Opening soon"
        }</span>
      </a>`
        )
        .join("\n      ")}
    </div>
  </div>
</section>

${
  deals.length
    ? `<section class="band" aria-labelledby="deals-heading">
  <div class="wrap">
    ${sectionHead("On offer this week", "Real reductions against a price the catalogue used to charge — no countdown timer.", {
      label: "All products",
      href: "shop.html",
    })}
    <div class="grid-products">
      ${deals.slice(0, 4).map((product) => productCard(product, { href: `product/${product.slug}.html` })).join("\n      ")}
    </div>
  </div>
</section>`
    : ""
}

<section class="band" aria-labelledby="cheap-heading">
  <div class="wrap">
    ${sectionHead("Under £25", "The add-ons that make an order worth the delivery box.")}
    <div class="grid-products">
      ${cheap.map((product) => productCard(product, { href: `product/${product.slug}.html` })).join("\n      ")}
    </div>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="promises">
      <h2>What every order gets</h2>
      <p style="color:#e6d8cd;margin:.2rem 0 0">No account, no subscription, no clever countdown timer. Four things, done properly.</p>
      <div class="grid">
        <div>
          <h3>2–3 working days</h3>
          <p>Dispatched from UK warehouses. £3.95, or free once the basket passes £40. Order before 2pm and it leaves today.</p>
        </div>
        <div>
          <h3>30 days, label in the box</h3>
          <p>Free returns on anything you change your mind about. Refund back to the card within three working days of the parcel landing.</p>
        </div>
        <div>
          <h3>The answer, on the page</h3>
          <p>Material, size, care, stock and delivery sit in a table you can skim on a phone — before you add anything to the basket.</p>
        </div>
      </div>
      <p class="more">Prices include VAT. No payment provider is connected in this demonstration build — <a href="pages/about.html">how this shop is put together</a>.</p>
    </div>
  </div>
</section>

${faqBlock(faqs)}

<section class="band" aria-labelledby="signup-heading">
  <div class="wrap">
    <h2 id="signup-heading">One email when something useful arrives</h2>
    <p style="max-width:38rem">New stock, price drops and the occasional guide. No daily nagging, and one click to leave.</p>
    <form class="signup" data-demo-form>
      <label class="visually-hidden" for="email">Email address</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" autocomplete="email">
      <button class="btn" type="submit">Join the list</button>
    </form>
    <p class="notice" data-demo-note hidden>This is a demonstration build: the form is not connected to a list. The mailing-list endpoint it would use is in the repository.</p>
  </div>
</section>`;

  await writeFile(
    path.join(OUT, "index.html"),
    renderPage({
      title: titleFor({}),
      description: descriptionFor({}),
      canonical: `${BRAND.url}/`,
      body: homeBody,
      nav: ctx.nav,
      jsonLd: [organisation(), webSite(), itemList(deals.length ? deals : products, "On offer"), faqSchema(faqs)],
      updated: UPDATED,
    }),
    "utf8"
  );
  pagesWritten.push({ url: `${BRAND.url}/`, priority: "1.0" });

  /* --------------------------------------------------------- departments */
  for (const group of groups) {
    const department = group.department;
    const stocked = group.products.length > 0;
    /* An empty shelf gets a page too: it ranks for the category term, it explains
       itself, and it means no tile on the home page is a link to nowhere. */
    const departmentFaqList = stocked ? departmentFaqs(group) : [];
    const siblings = groups.filter((entry) => entry.department.id !== department.id && entry.products.length > 0).slice(0, 4);
    const fillers = stocked ? [] : groups.flatMap((entry) => entry.products).slice(0, 4);
    const body = `
${breadcrumbs([{ label: "Home", href: "../index.html" }, { label: department.label }])}
<div class="wrap" style="padding-top:1rem">
  <h1>${escapeHtml(department.label)}</h1>
  <p style="max-width:44rem;color:var(--ink-2)">${escapeHtml(department.why)}</p>
  <p style="font-size:.88rem;color:var(--muted)">Sections: ${department.sections.map((section) => escapeHtml(section)).join(" · ")}</p>
</div>
<section class="band" style="padding-top:.6rem">
  <div class="wrap">
    ${
      stocked
        ? `<div class="grid-products">
      ${group.products.map((product) => productCard(product, { href: `../product/${product.slug}.html`, imageBase: "../" })).join("\n      ")}
    </div>`
        : `<div class="notice" style="max-width:44rem">This shelf opens soon. The supplier file has nothing on it yet, so there is nothing to sell you — and a page that pretends otherwise is the sort of thing this shop exists to avoid. The sections it will carry are listed above.</div>`
    }
  </div>
</section>
${stocked ? faqBlock(departmentFaqList, `${department.label}: the short answers`) : ""}
<section class="band">
  <div class="wrap">
    ${sectionHead(stocked ? "Keep looking" : "While this shelf fills up", "Departments with stock on the shelf today.")}
    <div class="depts">
      ${(stocked ? siblings : siblings.slice(0, 3))
        .map(
          (entry) => `<a class="dept" href="${entry.department.id}.html"><span class="name">${escapeHtml(entry.department.label)}</span><span class="count">${
            entry.products.length
          } products</span></a>`
        )
        .join("\n      ")}
    </div>
    ${
      stocked
        ? ""
        : `<div class="grid-products" style="margin-top:1.4rem">${fillers
            .map((product) => productCard(product, { href: `../product/${product.slug}.html`, imageBase: "../" }))
            .join("")}</div>`
    }
  </div>
</section>`;

    await writeFile(
      path.join(OUT, "department", `${department.id}.html`),
      renderPage({
        depth: 1,
        activeDept: department.id,
        title: titleFor({ department: department.label, purpose: "free delivery over £40" }),
        description: descriptionFor({ department: group }),
        /* An empty shelf is a real page, but it is not a page worth ranking:
           noindex until the supplier file fills it, then it joins the sitemap. */
        ...(stocked ? {} : { robots: "noindex,follow" }),
        canonical: `${BRAND.url}/department/${department.id}.html`,
        body,
        nav: navFor(groups, `department/${department.id}.html`),
        jsonLd: [
          organisation(),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${department.label} — ${BRAND.name}`,
            url: abs(`department/${department.id}.html`),
            description: descriptionFor({ department: group }),
            isPartOf: { "@type": "WebSite", name: BRAND.name, url: BRAND.url },
            mainEntity: { "@type": "ItemList", numberOfItems: group.products.length },
          },
          itemList(group.products, `${department.label} products`),
          breadcrumbJsonLd([
            { name: "Home", url: `${BRAND.url}/` },
            { name: department.label, url: abs(`department/${department.id}.html`) },
          ]),
          ...(departmentFaqList.length ? [faqSchema(departmentFaqList)] : []),
        ],
        updated: UPDATED,
      }),
      "utf8"
    );
    if (stocked) pagesWritten.push({ url: abs(`department/${department.id}.html`), priority: "0.8" });
  }

  /* ------------------------------------------------------------ products */
  for (const product of products) {
    const variant = product.variants.find((entry) => availability(entry) !== "OutOfStock") ?? product.variants[0]!;
    const price = listPrice(product)!;
    const stock = stockLabel(variant);
    const saving = savingPercent(product);
    const department = departmentFor(product.category);
    const related = relatedProducts(product, products, 4);
    const meta = pageMeta(product, format(price));
    const delivery = deliveryFor(price);

    const body = `
${breadcrumbs([
  { label: "Home", href: "../index.html" },
  { label: department.label, href: `../department/${department.id}.html` },
  { label: product.title },
])}
<div class="wrap">
  <div class="product-page">
    <div class="gallery">
      <img src="../${product.images[0]!.url}" alt="${escapeHtml(product.images[0]!.alt)}" width="600" height="600" fetchpriority="high">
    </div>
    <div>
      <p style="font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:.3rem">${escapeHtml(
        product.brand
      )} · ${escapeHtml(department.label)}</p>
      <h1 style="font-size:clamp(1.6rem,3.4vw,2.3rem)">${escapeHtml(product.title)}</h1>
      <div class="buybox">
        <div class="price-row" style="margin:0 0 .2rem">
          <span class="price">${format(price)}</span>
          ${variant.compareAt ? `<span class="was">${format(variant.compareAt)}</span><span class="tag" style="position:static">Save ${saving}%</span>` : ""}
        </div>
        <p style="font-size:.8rem;color:var(--muted);margin:.1rem 0 .5rem">Including VAT. ${escapeHtml(delivery.label)}${
          delivery.free ? "" : ` — free over ${format(money(BRAND.delivery.freeOver, "GBP"))}`
        }.</p>
        <p class="stock-line"><span class="stock-${stock.tone}">${escapeHtml(stock.text)}</span></p>
        <div class="buynow">
          ${
            stock.tone === "out"
              ? `<button class="btn" type="button" disabled aria-describedby="out-note">Out of stock</button>
          <a class="icon-btn" href="mailto:${BRAND.email}?subject=${encodeURIComponent(
            `Email me when ${product.title} is back`
          )}">Email me when it is back</a>`
              : `<div class="qty">
            <button type="button" aria-label="Decrease quantity" data-qty-down>−</button>
            <input type="number" value="1" min="1" max="10" aria-label="Quantity" data-qty>
            <button type="button" aria-label="Increase quantity" data-qty-up>+</button>
          </div>
          <button class="btn" type="button" data-add="${escapeHtml(product.id)}" data-title="${escapeHtml(product.title)}" data-price="${format(
            price
          )}" data-image="../${product.images[0]!.url}">Add to basket</button>`
          }
        </div>
        ${
          stock.tone === "out"
            ? `<p class="notice" id="out-note">Nothing to add to the basket: the supplier file says zero stock, and the last thing this shop should do is take an order it cannot fill. The price stays on the page so you can compare it when it returns.</p>`
            : ""
        }
        <p class="notice">Card payment through Stripe. Delivery is worked out in the basket before you pay, and the demonstration catalogue notice above still applies.</p>
        <div class="accordion">
          <details open>
            <summary>Delivery</summary>
            <div class="inner"><p>${escapeHtml(deliveryLine(product))}. Orders placed before ${BRAND.delivery.cutOff} are dispatched the same working day. Next-day delivery is ${format(
              money(BRAND.delivery.express, "GBP")
            )} where the carrier allows it.</p></div>
          </details>
          <details>
            <summary>Returns</summary>
            <div class="inner"><p>${escapeHtml(product.returnPolicy.summary)} The label is in the box; refunds go back to the card you paid with within three working days of the parcel arriving.</p></div>
          </details>
          <details>
            <summary>Care and materials</summary>
            <div class="inner"><p>${escapeHtml(
              Object.entries(product.specs ?? {})
                .map(([label, value]) => `${label}: ${value}`)
                .join(". ") || "The supplier does not list materials for this line."
            )}</p></div>
          </details>
        </div>
      </div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:2rem;padding-bottom:1rem" class="product-page">
    <div>
      <h2>About this ${escapeHtml(product.title.toLowerCase())}</h2>
      <p>${escapeHtml(product.description)}</p>
      <h2 style="font-size:1.2rem">Key facts</h2>
      ${factsTable(productFacts(product))}
    </div>
    <div>
      <h2 style="font-size:1.2rem">Why people buy it</h2>
      <ul>
        <li>${escapeHtml(stock.text)} — the number comes from the supplier file, not a guess.</li>
        <li>${escapeHtml(deliveryLine(product))}.</li>
        <li>${product.returnPolicy.days} days to change your mind, with the label in the box.</li>
        <li>Price includes VAT, and there is no surcharge at the last step.</li>
      </ul>
      <p class="notice">${escapeHtml(BRAND.notice)}</p>
    </div>
  </div>
</div>
<section class="band">
  <div class="wrap">
    ${sectionHead("Goes with this", "Same department first, then anything else in stock.")}
    <div class="grid-products">
      ${related.map((entry) => productCard(entry, { href: `${entry.slug}.html`, imageBase: "../" })).join("\n      ")}
    </div>
  </div>
</section>`;

    await writeFile(
      path.join(OUT, "product", `${product.slug}.html`),
      renderPage({
        depth: 1,
        title: meta.title,
        description: meta.description,
        canonical: abs(`product/${product.slug}.html`),
        body,
        nav: navFor(groups),
        jsonLd: [
          organisation(),
          offerSchema(product),
          breadcrumbJsonLd([
            { name: "Home", url: `${BRAND.url}/` },
            { name: department.label, url: abs(`department/${department.id}.html`) },
            { name: product.title, url: abs(`product/${product.slug}.html`) },
          ]),
        ],
        updated: UPDATED,
      }),
      "utf8"
    );
    pagesWritten.push({ url: abs(`product/${product.slug}.html`), priority: "0.9" });
  }

  /* ---------------------------------------------------------- shop index */
  const shopBody = `
${breadcrumbs([{ label: "Home", href: "index.html" }, { label: "All products" }])}
<div class="wrap" style="padding-top:1rem">
  <h1>All ${products.length} products</h1>
  <p style="max-width:44rem;color:var(--ink-2)">Every line in the catalogue, grouped by department. Prices include VAT, delivery is free over £40, and anything out of stock says so.</p>
  <nav aria-label="Jump to a department" style="display:flex;flex-wrap:wrap;gap:.4rem;margin:1rem 0 0">
    ${groups
      .filter((group) => group.products.length > 0)
      .map(
        (group) =>
          `<a class="icon-btn" href="#d-${group.department.id}">${escapeHtml(group.department.label)} <span style="color:var(--muted);font-weight:500">${group.products.length}</span></a>`
      )
      .join("\n    ")}
  </nav>
</div>
${groups
  .filter((group) => group.products.length > 0)
  .map(
    (group) => `<section class="band" aria-labelledby="d-${group.department.id}">
  <div class="wrap">
    ${sectionHead(group.department.label, group.department.blurb, {
      label: `See all ${group.products.length} in ${group.department.label}`,
      href: `department/${group.department.id}.html`,
    }).replace("<h2>", `<h2 id="d-${group.department.id}">`)}
    <div class="grid-products">
      ${group.products.map((product) => productCard(product, { href: `product/${product.slug}.html` })).join("\n      ")}
    </div>
  </div>
</section>`
  )
  .join("\n")}`;

  await writeFile(
    path.join(OUT, "shop.html"),
    renderPage({
      title: titleFor({ department: `All ${products.length} products`, purpose: "prices in pounds" }),
      description: `Every product in the ${BRAND.name} catalogue — ${products.length} lines across ${
        groups.filter((group) => group.products.length).length
      } departments, prices in pounds including VAT, free delivery over £40.`.slice(0, 155),
      canonical: `${BRAND.url}/shop.html`,
      body: shopBody,
      nav: navFor(groups, "shop.html"),
      jsonLd: [organisation(), itemList(products, "All products")],
      updated: UPDATED,
    }),
    "utf8"
  );
  pagesWritten.push({ url: `${BRAND.url}/shop.html`, priority: "0.8" });

  /* -------------------------------------------------------------- search */
  const searchBody = `
<div class="wrap" style="padding-top:1.4rem">
  <h1 data-search-heading>Search the shop</h1>
  <p style="color:var(--muted);max-width:40rem">Type a word — “oak”, “garden”, “storage” — and the page filters the catalogue as you type. No query leaves your browser.</p>
  <form class="search" action="search.html" method="get" role="search" style="max-width:34rem;margin-bottom:1.4rem">
    <label class="visually-hidden" for="q2">Search products</label>
    <input id="q2" type="search" name="q" placeholder="Search the catalogue" data-search-input>
    <button type="submit">Search</button>
  </form>
  <div class="grid-products" data-search-results><p class="empty">Loading the catalogue…</p></div>
</div>`;

  await writeFile(
    path.join(OUT, "search.html"),
    renderPage({
      title: `Search — ${BRAND.name}`,
      description: "Search the catalogue by product, brand or department.",
      canonical: `${BRAND.url}/search.html`,
      robots: "noindex,follow",
      body: searchBody,
      nav: navFor(groups),
      jsonLd: [organisation()],
      updated: UPDATED,
    }),
    "utf8"
  );

  /* -------------------------------------------------------------- pages */
  const policyBody = (title: string, lede: string, sections: { heading: string; body: string[] }[]) => `
${breadcrumbs([{ label: "Home", href: "../index.html" }, { label: title }])}
<div class="wrap" style="padding-top:1rem;max-width:52rem">
  <h1>${escapeHtml(title)}</h1>
  <p style="color:var(--ink-2)">${escapeHtml(lede)}</p>
  ${sections
    .map(
      (section) => `<h2 style="font-size:1.25rem;margin-top:1.6rem">${escapeHtml(section.heading)}</h2>${section.body
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("")}`
    )
    .join("\n  ")}
  <p class="notice">${escapeHtml(BRAND.notice)}</p>
</div>`;

  /* ---------------------------------------------------------------- legal */

  /* Four pages the shop cannot legally run without, written from what this code
     actually does rather than from a template: the basket is localStorage, there
     is no account, no cookie is set by these pages, and the payment is Stripe's.

     The temptation with legal copy is to say "we may share your data with trusted
     partners" and mean nothing by it. Every sentence here names a real thing —
     the key in the browser, the field on the payment page, the statutory right —
     so that if the shop ever changes, the page it contradicts is obvious. */

  const legalPages: { slug: string; title: string; description: string; lede: string; sections: { heading: string; body: string[] }[] }[] = [
    {
      slug: "privacy",
      title: "Privacy notice",
      description: `What ${BRAND.name} collects, why, how long it keeps it, and how to have it deleted.`,
      lede: "This shop collects as little as it can and says exactly what that is. If a sentence here does not match what the site does, the sentence is wrong and the site is the truth.",
      sections: [
        {
          heading: "What is collected, and where it lives",
          body: [
            `A basket is kept in your own browser under the key "hearth-grain-basket". It never reaches a server: close the tab and it is still there, clear your site data and it is gone. There is no account, no login and no profile.`,
            "Your name, delivery address and email are typed on Stripe's payment page, not on this site. They go to Stripe, who process the payment, and to the shop only as part of the order when selling is switched on.",
            `Email sent to ${BRAND.email} is kept in the inbox it arrives in for as long as the question takes to answer, and then as long as tax law requires on a sale.`,
          ],
        },
        {
          heading: "What is not collected",
          body: [
            "No analytics, no advertising pixels, no session recording, no heat maps, no fingerprinting. The pages set no cookie of their own and make no request to a third party except the fonts and images served from this domain.",
            "No special-category data, no date of birth, no payment card details: card numbers are entered on Stripe's page and never touch this server, which is why the shop can say it has never seen one.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Under the UK GDPR you can ask for a copy of what is held about you, ask for it to be corrected, or ask for it to be deleted. Write to " +
              BRAND.email +
              " and the answer will say what was found, or that nothing was.",
            "If you are not satisfied with the answer you can complain to the Information Commissioner's Office — the ICO, at ico.org.uk. A complaint to them costs nothing and does not need a solicitor.",
          ],
        },
        {
          heading: "Who else is involved",
          body: [
            "Stripe processes payments and is the only processor this shop needs. Their privacy notice explains what they keep and for how long; the shop cannot see a card number and does not store one.",
            "The site is hosted on Vercel, which keeps standard server logs (address, time, page) for security and to run the service. Those logs are the host's, not a marketing list, and are not used to build a profile of you.",
          ],
        },
      ],
    },
    {
      slug: "terms",
      title: "Terms of sale",
      description: `The terms that apply when you buy from ${BRAND.name}: price, delivery, cancellation, returns and liability.`,
      lede: "Plain terms, in the order they matter: what you pay, when it arrives, what happens if you change your mind or something is wrong.",
      sections: [
        {
          heading: "Price and payment",
          body: [
            `Every price on this site includes VAT at 20%. The price shown on the product page is the price in the basket, and the basket is the price at checkout — if those three ever disagree the shop has a fault and the lowest of them is what you pay.`,
            `Standard delivery is ${format(money(BRAND.delivery.standard, "GBP"))} and free on orders over ${format(money(BRAND.delivery.freeOver, "GBP"))}; it is added in the basket before you pay, never afterwards.`,
            "Payment is taken by Stripe at the moment the order is placed. The shop never sees or stores card details.",
          ],
        },
        {
          heading: "Delivery",
          body: [
            `Orders placed before ${BRAND.delivery.cutOff} on a working day are dispatched the same day; anything later goes the next working day. Standard delivery takes ${BRAND.delivery.standardDays[0]}–${BRAND.delivery.standardDays[1]} working days from dispatch.`,
            "Dispatch times are the shop's promise; the carrier's transit time is theirs. If a parcel is late, write to " +
              BRAND.email +
              " and the shop will chase it rather than asking you to.",
          ],
        },
        {
          heading: "Changing your mind",
          body: [
            `You have 14 days from delivery to cancel for any reason, under the Consumer Contracts Regulations 2013. Tell the shop in writing — an email is enough — and send the item back within 14 days of telling them.`,
            `Returns are free for ${BRAND.returns.days} days and the label is in the box. Refunds are paid within 14 days of the goods arriving back, to the card used.`,
            "Two honest exceptions: perishable goods, and anything cut or personalised to your order, cannot be returned unless it is faulty. Nothing on this site is personalised today.",
          ],
        },
        {
          heading: "If something is wrong",
          body: [
            "Goods must be as described, of satisfactory quality and fit for purpose under the Consumer Rights Act 2015. If they are not, the shop will repair, replace or refund — your choice, and the law's.",
            "Report a fault to " +
              BRAND.email +
              " with the order reference and a photograph. A fault reported within 30 days is treated as having been there from the start.",
          ],
        },
        {
          heading: "Liability, and what these terms do not change",
          body: [
            "Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow to be limited. Those rights exist whatever this page says.",
            "Beyond that, liability is limited to the price of the goods in the order concerned. The shop is not liable for loss that was not foreseeable when the order was placed.",
            "These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.",
          ],
        },
      ],
    },
    {
      slug: "cookies",
      title: "Cookies",
      description: "Which cookies this shop sets (none of its own), what it keeps in your browser instead, and how to remove it.",
      lede: "This shop sets no cookies of its own — not one. What it keeps instead is a basket in your browser's local storage, which is not a cookie and is not sent anywhere.",
      sections: [
        {
          heading: "What is stored, and under what name",
          body: [
            `Local storage, key "hearth-grain-basket": the products in your basket and how many. Readable only by this site, never sent to a server, no expiry — it stays until you clear it.`,
            "No preference cookies, no session cookie, no consent cookie, no analytics cookie, no advertising cookie. There is nothing here to consent to, which is why there is no banner asking for consent it would not use.",
          ],
        },
        {
          heading: "Third parties",
          body: [
            "When you press pay, you are on Stripe's page and Stripe's cookies apply — they use them to process the payment and to detect fraud. Their cookie notice explains them; this page cannot.",
            "Embedded video, maps, chat widgets and social buttons all set cookies. This shop has none of them, deliberately: each one would be a reason to need a banner.",
          ],
        },
        {
          heading: "How to remove it",
          body: [
            "Clear the site's data in your browser (Settings → Privacy → Cookies and site data → this site). The basket disappears with it, which is the whole of what is stored.",
            "Private or incognito windows keep the basket until the window closes and then drop it.",
          ],
        },
      ],
    },
    {
      slug: "accessibility",
      title: "Accessibility",
      description: `How ${BRAND.name} is built for keyboard, screen reader and zoom, what has been tested, and what has not.`,
      lede: "An honest statement: what has been done, what has been checked, and what nobody has checked yet. The last list is the short one that matters.",
      sections: [
        {
          heading: "What the pages do",
          body: [
            "Every page has one h1, labelled form fields, a skip link to the main content, a visible focus ring on every control, and touch targets of at least 44px on a phone.",
            "Colour contrast is at least 4.5:1 for body text and 3:1 for large text and interface borders. Nothing on the shop depends on colour alone: a sold-out product says so in words as well as in grey.",
            "The basket is a native <dialog>, so the keyboard, Escape and focus handling are the browser's rather than a script's. The site works with JavaScript disabled for reading — the basket is the one thing that needs it, and the basket says so.",
            "Text reflows at 320px wide and to 200% zoom without horizontal scrolling, and the pages honour prefers-reduced-motion by turning off the transitions.",
          ],
        },
        {
          heading: "What has been checked",
          body: [
            "Automated checks run in the build: heading order, image alt text, form labels, and a link check that follows every internal link on the 404 page. The basket, the search and the keyboard path are covered by tests in this repository.",
          ],
        },
        {
          heading: "What has not been checked, yet",
          body: [
            "No screen reader has been used with this shop — not VoiceOver, not NVDA, not TalkBack. That is the largest gap and it is stated here rather than glossed over.",
            "No manual audit against WCAG 2.2 AA has been done, and nothing has been run on a real iPhone or Android device, only in a desktop browser at phone widths.",
            `If something is hard to use, write to ${BRAND.email} with the page and what happened. Accessibility faults are treated as bugs, not as feature requests.`,
          ],
        },
        {
          heading: "If the shop cannot be used",
          body: [
            `Order by email instead: ${BRAND.email}, with the product names and a delivery address. The same prices, the same returns, the same 14-day right to cancel — the page is a convenience, not a condition of buying.`,
          ],
        },
      ],
    },
  ];

  for (const page of legalPages) {
    await writeFile(
      path.join(OUT, "pages", `${page.slug}.html`),
      renderPage({
        depth: 1,
        title: `${page.title} — ${BRAND.name}`,
        description: page.description,
        canonical: `${BRAND.url}/pages/${page.slug}.html`,
        body: policyBody(page.title, page.lede, page.sections),
        nav: navFor(groups),
        jsonLd: [organisation()],
        updated: UPDATED,
      }),
      "utf8"
    );
    pagesWritten.push({ url: abs(`pages/${page.slug}.html`), priority: "0.3" });
  }

  /* Where Stripe sends the customer back to. It has to exist, it has to be a real
     page, and it must not claim to know the order: the function that could tell
     it does not exist yet, and a page that invents a confirmation is worse than
     an honest one. */
  const orderBody = `
<div class="wrap" style="padding-top:1rem;max-width:44rem">
  <h1>Thank you — your payment went through</h1>
  <p style="color:var(--ink-2)">Stripe has taken the payment and emailed the receipt, which is the proof of purchase to keep.</p>
  <h2 style="font-size:1.2rem;margin-top:1.5rem">What happens now</h2>
  <ul style="color:var(--ink-2);line-height:1.6">
    <li>Orders placed before ${escapeHtml(BRAND.delivery.cutOff)} on a working day are dispatched the same day.</li>
    <li>Standard delivery is ${escapeHtml(format(money(BRAND.delivery.standard, "GBP")))} and takes ${BRAND.delivery.standardDays[0]}–${BRAND.delivery.standardDays[1]} working days; it is free over ${escapeHtml(format(money(BRAND.delivery.freeOver, "GBP")))}.</li>
    <li>Returns are free for ${BRAND.returns.days} days, with the label in the box.</li>
  </ul>
  <h2 style="font-size:1.2rem;margin-top:1.5rem">What is not automatic yet</h2>
  <p style="color:var(--ink-2)">This demonstration shop does not send its own order email or update stock: both are on the list in
  <code>docs/not-yet-done-2026-11-20.md</code>. Stripe's receipt is the confirmation; the order itself is in the Stripe dashboard.</p>
  <p><a class="btn" href="../shop.html">Back to the shop</a> · <a href="contact.html">Something wrong? Tell us</a></p>
  <p class="notice">${escapeHtml(BRAND.notice)}</p>
</div>`;

  await writeFile(
    path.join(OUT, "pages", "order-complete.html"),
    renderPage({
      depth: 1,
      title: titleFor({ department: "Order complete" }),
      description: "Your payment went through. What happens next, and what this demonstration shop does not do yet.",
      canonical: `${BRAND.url}/pages/order-complete.html`,
      body: orderBody,
      nav: navFor(groups, "pages/order-complete.html"),
      jsonLd: [organisation()],
      updated: UPDATED,
      robots: "noindex,follow",
    }),
    "utf8"
  );

  await writeFile(
    path.join(OUT, "pages", "delivery-returns.html"),
    renderPage({
      depth: 1,
      title: titleFor({ department: "Delivery & returns" }),
      description: `Delivery is ${format(money(BRAND.delivery.standard, "GBP"))} and free over ${format(
        money(BRAND.delivery.freeOver, "GBP")
      )}; returns are free for ${BRAND.returns.days} days.`,
      canonical: `${BRAND.url}/pages/delivery-returns.html`,
      body: policyBody("Delivery & returns", "The costs are on this page and on the product page, before you pay — not at the last step of a checkout.", [
        {
          heading: "Delivery",
          body: [
            `Standard delivery is ${format(money(BRAND.delivery.standard, "GBP"))} and free on orders over ${format(
              money(BRAND.delivery.freeOver, "GBP")
            )}. Orders placed before ${BRAND.delivery.cutOff} on a working day are dispatched the same day.`,
            `Standard delivery takes ${BRAND.delivery.standardDays[0]}–${BRAND.delivery.standardDays[1]} working days. Next-day is ${format(
              money(BRAND.delivery.express, "GBP")
            )} where the item's size and the carrier allow it.`,
            "Everything is dispatched from UK warehouses. If a line is out of stock, the product page says so rather than taking an order it cannot fill.",
          ],
        },
        {
          heading: "Returns",
          body: [
            BRAND.returns.summary,
            "The label is in the box. Refunds go back to the card you paid with, usually within three working days of the parcel reaching the warehouse.",
            "Faulty goods are collected and replaced at our cost. If something arrives damaged, send a photograph and the order number — no form-filling.",
          ],
        },
        {
          heading: "If the price looks wrong",
          body: [
            "Prices come from a supplier file and are checked at build time. If a price is obviously wrong when you order, we will tell you before taking payment rather than shipping something and invoicing the difference.",
          ],
        },
      ]),
      nav: navFor(groups, "pages/delivery-returns.html"),
      jsonLd: [organisation()],
      updated: UPDATED,
    }),
    "utf8"
  );
  pagesWritten.push({ url: abs("pages/delivery-returns.html"), priority: "0.5" });

  await writeFile(
    path.join(OUT, "pages", "about.html"),
    renderPage({
      depth: 1,
      title: titleFor({ department: "Why this shop exists" }),
      description: `How ${BRAND.name} is built: supplier feeds, static pages, real structured data, and the list of things it deliberately does not do yet.`,
      canonical: `${BRAND.url}/pages/about.html`,
      body: policyBody(
        "Why this shop exists",
        `${BRAND.name} is a build, not a brand: a demonstration of a small shop that does the boring things properly.`,
        [
          {
            heading: "What is real",
            body: [
              "The catalogue, the pricing arithmetic, the structured data, the Merchant feed, the sitemap, the accessibility and performance budgets and the tests are real code, in the repository this page was built from.",
              "Every page is static HTML. Nothing important needs JavaScript: the search page filters a JSON file in your browser, and the basket is kept in local storage on your device.",
            ],
          },
          {
            heading: "What is not real",
            body: [
              BRAND.notice,
              "There is no payment provider connected, no order record, no reviews and no stock reservation. GAPS.md lists all of it in the order it should be built.",
            ],
          },
          {
            heading: "If something goes wrong",
            body: [
              `Email ${BRAND.email} and a person answers. The policy pages say what happens on a late parcel, a damaged item and a change of mind, and the returns window is ${BRAND.returns.days} days rather than the statutory minimum dressed up as generosity.`,
            ],
          },
          {
            heading: "The build",
            body: [
              "A supplier CSV is imported with per-row reporting, validated against a catalogue model, and built into pages with Product, Offer, ReturnPolicy, Breadcrumb, CollectionPage, ItemList, FAQPage, WebSite and OnlineStore structured data.",
              "The same run writes llms.txt and llms-full.txt for answer engines, a Google Merchant feed, products.json for apps, and a sitemap for crawlers.",
            ],
          },
        ]
      ),
      nav: navFor(groups),
      jsonLd: [organisation(), { ...webSite() }],
      updated: UPDATED,
    }),
    "utf8"
  );
  pagesWritten.push({ url: abs("pages/about.html"), priority: "0.4" });

  await writeFile(
    path.join(OUT, "pages", "contact.html"),
    renderPage({
      depth: 1,
      title: titleFor({ department: "Contact" }),
      description: `How to reach ${BRAND.name}: email, phone and what happens next.`,
      canonical: `${BRAND.url}/pages/contact.html`,
      body: policyBody("Contact", "A person reads this, not a ticket robot. Expect a reply the same working day.", [
        {
          heading: "The fastest routes",
          body: [
            `Email ${BRAND.email} for orders, returns and anything about a product. Include the order number if you have one.`,
            `Phone ${BRAND.phone}, Monday to Friday, 9am–5pm UK time.`,
          ],
        },
        {
          heading: "Press and trade",
          body: [`Trade and wholesale enquiries go to the same address with "trade" in the subject line — they are answered by a person who can quote prices.`],
        },
      ]),
      nav: navFor(groups),
      jsonLd: [organisation()],
      updated: UPDATED,
    }),
    "utf8"
  );
  pagesWritten.push({ url: abs("pages/contact.html"), priority: "0.4" });

  /* --------------------------------------------------------- data files */
  const feedProducts = products.map((product) => ({
    ...product,
    images: product.images.map((image) => ({ url: abs(image.url), alt: image.alt })),
  }));

  const feed = googleFeed(feedProducts, {
    linkBase: BRAND.url,
    shipping: `GB::Standard delivery:${(BRAND.delivery.standard / 100).toFixed(2)} GBP`,
  });
  await writeFile(path.join(OUT, "google-feed.csv"), feed.csv, "utf8");

  await writeFile(
    path.join(OUT, "products.json"),
    productsJson(
      feedProducts.map((product) => ({ ...product, images: [{ url: product.images[0]!.url.replace(`${BRAND.url}/`, ""), alt: product.images[0]!.alt }] })),
      BRAND.url
    ),
    "utf8"
  );

  /* ------------------------------------------------------ the shop as an app */

  /* An installable shop is a manifest and an icon: no service worker, no offline
     promise the basket could not keep, just a name, a colour and a start page so a
     phone can put it on a home screen instead of a bookmark. */
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="${escapeHtml(BRAND.name)}">
  <rect width="192" height="192" rx="28" fill="#e8607f"/>
  <text x="96" y="126" font-family="Georgia, serif" font-size="84" font-weight="700" fill="#fffdf9" text-anchor="middle">H&amp;G</text>
</svg>`;
  await writeFile(path.join(OUT, "assets", "icon.svg"), icon, "utf8");
  await writeFile(
    path.join(OUT, "manifest.webmanifest"),
    JSON.stringify(
      {
        name: BRAND.name,
        short_name: "Hearth & Grain",
        description: BRAND.description,
        start_url: "/index.html",
        scope: "/",
        display: "browser",
        background_color: "#fdfaf6",
        theme_color: "#e8607f",
        lang: "en-GB",
        icons: [{ src: "/assets/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  /* A 404 is a page, not a server default. On a static host every miss lands here,
     and a visitor who mistyped a product has one useful question: what else is
     there? So the page carries the search box and the departments, and says plainly
     that it is a 404 rather than pretending the URL was right. */
  const notFoundBody = `
<div class="wrap" style="padding-top:1rem;max-width:44rem">
  <p class="muted small">404 — page not found</p>
  <h1>That page is not here</h1>
  <p style="color:var(--ink-2)">The address may have a typo in it, or the product may have been renamed. Nothing is broken: the shop is right behind this page.</p>
  <form class="search" action="search.html" method="get" role="search" style="margin:1rem 0">
    <label class="visually-hidden" for="q404">Search products</label>
    <input id="q404" type="search" name="q" placeholder="Search ${products.length} products — try “oak” or “planter”">
    <button type="submit">Search</button>
  </form>
  <h2 style="font-size:1.2rem;margin-top:1.5rem">Departments</h2>
  <ul style="color:var(--ink-2);line-height:1.7">
    ${groups.map((group) => `<li><a href="department/${group.department.id}.html">${escapeHtml(group.department.label)}</a></li>`).join("\n    ")}
  </ul>
  <p style="margin-top:1.5rem"><a class="btn" href="index.html">Back to the shop</a> · <a href="pages/contact.html">Tell us what you were looking for</a></p>
  <p class="notice">${escapeHtml(BRAND.notice)}</p>
</div>`;
  await writeFile(
    path.join(OUT, "404.html"),
    renderPage({
      depth: 0,
      title: `Page not found — ${BRAND.name}`,
      description: "That page is not here. Search the shop, or browse the departments.",
      canonical: `${BRAND.url}/404.html`,
      body: notFoundBody,
      nav: navFor(groups),
      jsonLd: [organisation()],
      updated: UPDATED,
      robots: "noindex,follow",
    }),
    "utf8"
  );

  /* The search box runs in the browser, so the index ships with the pages: the
     same tokeniser and synonyms the framework's own search uses, without a server. */
  await writeFile(
    path.join(OUT, "search-index.json"),
    JSON.stringify(
      buildIndex(products, SEARCH_SYNONYMS).map((doc) => ({ id: doc.id, slug: doc.slug, title: doc.title, tokens: doc.tokens })),
      null,
      2
    ) + "\n",
    "utf8"
  );

  await writeFile(
    path.join(OUT, "llms.txt"),
    llmsTxt({
      name: BRAND.name,
      url: BRAND.url,
      summary: `${products.length} homeware, garden and kitchen products from a UK shop. Prices in pounds including VAT. Free delivery over £40, 30-day returns.`,
      currency: "GBP",
      facts: [
        `Standard delivery ${format(money(BRAND.delivery.standard, "GBP"))}, free over ${format(money(BRAND.delivery.freeOver, "GBP"))}`,
        `Returns: ${BRAND.returns.summary}`,
        `Departments: ${groups.map((group) => group.department.label).join(", ")}`,
        `Opening soon, with no stock yet: ${groups
          .filter((group) => !group.products.length)
          .map((group) => group.department.label)
          .join(", ")}`,
        `Product data: ${BRAND.url}/products.json · departments and products: ${BRAND.url}/shop.html`,
        "Search runs in the browser; every product page is static HTML with Product, Offer, ReturnPolicy and shipping markup",
        "All prices include UK VAT at 20%",
        "No account is needed to browse, and no payment provider is connected in this build",
      ],
      products: products.map((product) => ({
        title: product.title,
        url: abs(`product/${product.slug}.html`),
        price: format(listPrice(product)!),
      })),
      policies: {
        returns: `${BRAND.returns.days} days, free, label in the box`,
        delivery: `free over ${format(money(BRAND.delivery.freeOver, "GBP"))}, otherwise ${format(
          money(BRAND.delivery.standard, "GBP")
        )}`,
        contact: BRAND.email,
      },
    }),
    "utf8"
  );

  /* The long version: everything an answer engine would otherwise have to guess. */
  const fullLines: string[] = [
    `# ${BRAND.name} — full catalogue`,
    "",
    `> ${BRAND.description}`,
    "",
    `Updated ${UPDATED}. Prices in GBP including 20% VAT. ${BRAND.notice}`,
    "",
    "## Policies",
    `- Delivery: ${format(money(BRAND.delivery.standard, "GBP"))} standard, free over ${format(money(BRAND.delivery.freeOver, "GBP"))}; ${BRAND.delivery.standardDays[0]}–${BRAND.delivery.standardDays[1]} working days; next day ${format(money(BRAND.delivery.express, "GBP"))}.`,
    `- Returns: ${BRAND.returns.summary}`,
    `- Contact: ${BRAND.email} · ${BRAND.phone}`,
    "",
  ];
  for (const group of groups.filter((entry) => entry.products.length > 0)) {
    fullLines.push(`## ${group.department.label}`, "", group.department.blurb, "");
    for (const product of group.products) {
      const variant = product.variants[0]!;
      fullLines.push(
        `### ${product.title}`,
        `- Price: ${format(listPrice(product)!)} including VAT${variant.compareAt ? ` (was ${format(variant.compareAt)})` : ""}`,
        `- Stock: ${stockLabel(variant).text}`,
        `- ID: ${variant.sku}${variant.gtin ? ` · GTIN ${variant.gtin}` : ""}${variant.mpn ? ` · MPN ${variant.mpn}` : ""}`,
        `- Delivery: ${deliveryLine(product)}`,
        `- Returns: ${product.returnPolicy.days} days, free`,
        ...Object.entries(product.specs ?? {}).map(([label, value]) => `- ${label}: ${value}`),
        `- Page: ${abs(`product/${product.slug}.html`)}`,
        "",
        product.description,
        ""
      );
    }
  }
  fullLines.push("## Departments", "");
  for (const group of groups) {
    fullLines.push(
      `- ${group.department.label} (${group.products.length} products)${group.products.length ? `: ${abs(`department/${group.department.id}.html`)}` : " — coming soon"}`
    );
  }
  fullLines.push("", "## The catalogue as data", `- ${abs("products.json")}`, `- ${abs("google-feed.csv")}`, "");
  await writeFile(path.join(OUT, "llms-full.txt"), fullLines.join("\n"), "utf8");

  await writeFile(
    path.join(OUT, "sitemap.xml"),
    sitemap(
      pagesWritten.sort((a, b) => Number(b.priority) - Number(a.priority)).map((entry) => entry.url),
      UPDATED
    ),
    "utf8"
  );

  await writeFile(
    path.join(OUT, "robots.txt"),
    `# ${BRAND.name} — static catalogue. Everything here is meant to be read.
User-agent: *
Allow: /

# Answer engines and AI crawlers: welcome, the facts are in /llms.txt
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${BRAND.url}/sitemap.xml
# Facts for assistants: ${BRAND.url}/llms.txt
`,
    "utf8"
  );

  /* ------------------------------------------------------------- report */
  console.log(`source        ${path.relative(process.cwd(), SOURCE)}`);
  console.log(`brand         ${BRAND.name} — ${BRAND.url}`);
  console.log(`profile       ${imported.profile.label} (${imported.profile.id})`);
  console.log(`rows          ${rows} read, ${imported.stats.imported} imported, ${imported.stats.skipped} skipped, ${imported.stats.repaired} repaired`);
  const byProblem = new Map<string, number>();
  for (const issue of imported.issues) byProblem.set(`${issue.action}: ${issue.problem}`, (byProblem.get(`${issue.action}: ${issue.problem}`) ?? 0) + 1);
  for (const [problem, count] of [...byProblem].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)} × ${problem}`);
  console.log(`departments   ${groups.map((group) => `${group.department.id} ${group.products.length}`).join(", ")}`);
  console.log(`pages         home + ${groups.length} departments (${groups.filter((group) => !group.products.length).length} opening soon) + ${products.length} products + shop + search + 3 policy pages`);
  console.log(`schema        Product, Offer, ReturnPolicy, Breadcrumb, CollectionPage, ItemList, FAQPage, OnlineStore, WebSite+SearchAction`);
  console.log(`data          products.json, search-index.json, google-feed.csv (${feed.rows.length} rows, ${feed.rejected.length} rejected), llms.txt, llms-full.txt, sitemap.xml, robots.txt`);
  console.log(`validation    ${validation.length === 0 ? "0 issues" : `${validation.length} issues: ${validation.slice(0, 4).join("; ")}`}`);
  console.log(`images        ${products.length + 1} generated placeholders`);
  console.log(`checks        ${IMPORT_CHECKS.length} supplier checks still apply to this file`);
  console.log(`output        ${path.relative(process.cwd(), OUT)}`);
};

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
