/**
 * The blog plan for sitebuildup.co.uk, drawn from what this repository actually
 * measured rather than what a content calendar usually contains.
 *
 * Every brief carries the numbers it will argue from, the file in this repo that
 * proves each one, and the search query it is written to answer. If a figure
 * cannot be backed by a source already recorded in the repo, it does not go in.
 *
 * `npm run briefs` renders this file as BRIEFS.md; the Atlas in the Studio shows
 * the same objects as floating cards you can fly to.
 */
export interface Fact {
  /** The claim, short enough to be a sentence in the post. */
  point: string;
  /** The number and where it came from. */
  evidence: string;
}

export interface Brief {
  slug: string;
  title: string;
  /** The one idea the reader leaves with. */
  promise: string;
  /** Search query the post is written to answer, in the words a buyer would type. */
  query: string;
  /** Who it is for, in the agency's own terms. */
  audience: string;
  /** Where it sits in the site's service map. */
  service: "website-design" | "e-commerce" | "seo-marketing" | "business-automation" | "ai-automation" | "mobile-apps";
  status: "outline" | "draft" | "ready";
  words: number;
  outline: string[];
  facts: Fact[];
  /** Files in this repository that back the claims up. */
  proof: string[];
  /** The capability this brief is a by-product of, for the Atlas edges. */
  capability: string;
}

export const BRIEFS: Brief[] = [
  {
    slug: "checkout-losing-money",
    title: "Your checkout is losing 7 in 10 baskets — and it is fixable in a week",
    promise:
      "Most abandoned baskets are abandoned for reasons the shop controls: cost revealed late, an account wall, and a form twice as long as it needs to be.",
    query: "why do customers abandon checkout uk",
    audience: "Shop owners turning over £100k–£2m who built once and have not audited since",
    service: "e-commerce",
    status: "outline",
    words: 1600,
    outline: [
      "The 70.2% number, and what it does and does not mean",
      "The four preventable reasons, with the percentages",
      "What 23.5 form elements looks like on a phone",
      "The 7-element checkout we ship instead — field by field",
      "The one-week fix list, in order of return",
      "What we will not do: countdown timers, pre-ticked consent, forced accounts",
    ],
    facts: [
      { point: "Cart abandonment averages 70.2% across 50 studies", evidence: "Baymard, updated Sep 2025" },
      { point: "Unexpected costs cause 40–48% of preventable abandonments", evidence: "Baymard" },
      { point: "Forced account creation accounts for 18–26%", evidence: "Baymard" },
      { point: "The average US checkout shows 23.5 form elements; ~12 is achievable", evidence: "Baymard" },
      { point: "Mobile abandonment is ~80% against ~66% on desktop", evidence: "Baymard" },
    ],
    proof: ["commerce/src/checkout.ts", "commerce/src/cart.ts", "commerce/GAPS.md"],
    capability: "store-core",
  },
  {
    slug: "delivery-cost-before-payment",
    title: "Show the delivery price before the pay button, or watch them leave",
    promise:
      "Delivery is the cheapest conversion lever in a shop: it costs nothing to state, and it removes the largest single cause of abandonment.",
    query: "show delivery cost before checkout conversion",
    audience: "Shop owners and marketers who think of delivery as an ops decision",
    service: "e-commerce",
    status: "outline",
    words: 1200,
    outline: [
      "Why the last step is where trust breaks",
      "What 'costs shown before payment' means on a product page",
      "The card line: '+ £3.95 delivery' or 'Free delivery', never a surprise",
      "Free-delivery thresholds: the nudge that pays for itself",
      "How we build it so the price cannot drift from the policy",
    ],
    facts: [
      { point: "Unexpected costs are the top preventable abandonment reason at 40–48%", evidence: "Baymard" },
      { point: "A stated £3.95 with free over £40 removes the surprise without giving margin away", evidence: "commerce/catalogue/site.ts, the demo shop's policy" },
      { point: "The basket shows \"£15.50 more for free delivery\", not a countdown", evidence: "commerce/catalogue/render.ts" },
    ],
    proof: ["commerce/src/siteModel.ts", "commerce/catalogue/render.ts", "commerce/src/seo.ts"],
    capability: "supplier-catalogue",
  },
  {
    slug: "speed-100ms",
    title: "100 milliseconds of load time is worth 3.5% of your revenue",
    promise:
      "Speed is not a developer vanity metric; it is a conversion rate, and the work is mostly images and third-party scripts.",
    query: "site speed conversion rate 100ms",
    audience: "Owners who paid for a fast-looking site and never measured it",
    service: "website-design",
    status: "outline",
    words: 1400,
    outline: [
      "The two studies that decide this argument",
      "Why product images are the problem: the LCP element on 78–84% of pages",
      "What 39% of sites passing Core Web Vitals actually means",
      "The 2.0s / 200kB budget, and how a build can enforce it",
      "A before-and-after measurement you can run in an hour",
    ],
    facts: [
      { point: "Every 0.1s of load improvement lifts retail conversion ~8%", evidence: "Google/Deloitte" },
      { point: "Each 100ms of LCP improvement correlates with ~3.5% more conversions", evidence: "Shopify" },
      { point: "Stores at 1.5s LCP convert ~30% higher than those at 2.5s", evidence: "Shopify" },
      { point: "Only ~39% of ecommerce sites pass all three Core Web Vitals", evidence: "industry audits, 2026" },
    ],
    proof: ["commerce/src/budget.ts", "commerce/src/seo.ts"],
    capability: "store-core",
  },
  {
    slug: "search-box-revenue",
    title: "Your search box is a revenue surface, and 70% of queries fail on it",
    promise:
      "Shoppers who search buy more; when the search box fails on a synonym, they leave rather than browse.",
    query: "on-site search synonyms conversion",
    audience: "Shop and catalogue owners with more than 50 products",
    service: "e-commerce",
    status: "outline",
    words: 1300,
    outline: [
      "Search users convert several times better — and abandon at ~80% after a miss",
      "Why 'shelves' does not find 'shelf' in most shops",
      "Three fixes: synonyms, one-edit tolerance, a fallback that is not a dead end",
      "The zero-result list you are not keeping",
      "How the demo shop matches 'plantr' to planters",
    ],
    facts: [
      { point: "~70% of on-site searches fail on synonyms or typos", evidence: "industry search studies" },
      { point: "~80% of shoppers abandon after a poor search result", evidence: "industry search studies" },
      { point: "Only ~34% of sites offer useful autocomplete", evidence: "industry audits" },
      { point: "Typo tolerance is one edit-distance check — about 40 lines, not a platform migration", evidence: "commerce/src/search.ts" },
    ],
    proof: ["commerce/src/search.ts", "commerce/catalogue/site.ts"],
    capability: "supplier-catalogue",
  },
  {
    slug: "get-quoted-by-ai",
    title: "Getting quoted by ChatGPT and Perplexity: what actually decides it",
    promise:
      "AI answers cite pages with complete, machine-readable facts; most shops publish almost none, which is why they are not in the answer.",
    query: "how to get my website cited by chatgpt",
    audience: "UK SMBs who have noticed their traffic shifting to AI answers",
    service: "seo-marketing",
    status: "outline",
    words: 1800,
    outline: [
      "How an answer engine decides what to quote",
      "Only ~11% of Shopify stores have complete Product structured data",
      "The six fields an agent needs, and what happens when one is missing",
      "robots.txt as a decision: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot",
      "llms.txt: what it is, what it is not, and why we still ship it",
      "A 30-minute audit you can run on your own site",
    ],
    facts: [
      { point: "Only ~11% of Shopify stores carry complete Product structured data", evidence: "industry audits, 2026" },
      { point: "A generated catalogue can emit Product, Offer, ReturnPolicy and FAQPage on 50 pages in 0.6 seconds", evidence: "commerce/catalogue/scripts/build-site.mts" },
      { point: "7 fields decide it: name, offers.price, priceCurrency, availability, brand, GTIN/MPN and return policy", evidence: "commerce/src/catalog.ts validator" },
      { point: "robots.txt names 6 crawlers explicitly: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot", evidence: "commerce/catalogue/scripts/build-site.mts" },
    ],
    proof: ["commerce/src/seo.ts", "commerce/catalogue/scripts/build-site.mts", "commerce/src/siteModel.ts"],
    capability: "static-seo-pages",
  },
  {
    slug: "schema-that-earns-clicks",
    title: "The product schema that earns the click — and the one that gets you demoted",
    promise:
      "Structured data is a contract: faked ratings and invented compare-at prices are the fastest way to lose the placement you wanted.",
    query: "product structured data schema mistakes",
    audience: "Marketers who have been told to 'add schema' without knowing which",
    service: "seo-marketing",
    status: "outline",
    words: 1500,
    outline: [
      "What Google and shopping agents actually read",
      "The five fields that carry the placement",
      "Fabricated reviews: why AggregateRating without reviews is a liability",
      "Compare-at prices that were never charged",
      "How we validate before publishing",
    ],
    facts: [
      { point: "2 schema rules people get wrong: price as a decimal string ('49.99'), availability as a full schema.org URL", evidence: "commerce/src/seo.ts" },
      { point: "0 reviews means 0 AggregateRating — a rating without reviews is fabrication", evidence: "commerce/src/catalog.ts validator" },
      { point: "14 days is the legal floor for UK distance selling; 30 is the policy the demo shop ships", evidence: "commerce/src/catalog.ts" },
    ],
    proof: ["commerce/src/seo.ts", "commerce/src/catalog.ts", "commerce/src/seo.test.ts"],
    capability: "static-seo-pages",
  },
  {
    slug: "affiliate-vs-resell",
    title: "£3.99 or £3.71: the 28p that decides whether you hold stock",
    promise:
      "On a £49.99 product, referring the sale pays more than reselling it — with none of the stock, carriage or returns risk.",
    query: "affiliate vs dropshipping uk profit",
    audience: "Anyone deciding between an affiliate site and a stock-holding shop",
    service: "e-commerce",
    status: "outline",
    words: 1700,
    outline: [
      "The three routes, named properly",
      "The £49.99 sale, line by line, both ways",
      "Why VAT is divided, not subtracted",
      "Where the caps bite: AliExpress at £900, eBay at £3,000",
      "The decision rule: basket size, markup multiple, whose traffic it is",
      "Alibaba is not a commission route, and that matters",
    ],
    facts: [
      { point: "Affiliate at 8% on a 30-day cookie pays £3.99 on £49.99", evidence: "Aosom UK via Awin" },
      { point: "Reselling at a plausible trade price nets £3.71 after VAT, carriage, fees and returns", evidence: "commerce/COMMISSION.md, worked line by line" },
      { point: "AliExpress caps commission at US$50 per sale", evidence: "AliExpress Portals terms" },
      { point: "eBay caps 1–4% at US$100–550 per transaction, 24-hour cookie", evidence: "eBay Partner Network terms" },
      { point: "Amazon's API needs 3 qualifying sales in 180 days", evidence: "Amazon Associates" },
    ],
    proof: ["commerce/src/affiliate.ts", "commerce/COMMISSION.md"],
    capability: "store-core",
  },
  {
    slug: "twelve-departments",
    title: "Twelve departments, not a 'shop' page: how to structure a catalogue people can navigate",
    promise:
      "Navigation is merchandising. A flat grid of products loses the shopper who does not yet know what the product is called.",
    query: "ecommerce category structure best practice",
    audience: "Shops with 30–500 products and one long 'Shop' page",
    service: "website-design",
    status: "outline",
    words: 1300,
    outline: [
      "Why departments beat filters for browsing",
      "The twelve-department model, with sections",
      "Honesty about empty shelves, and why that earns trust",
      "Aliases: mapping a supplier's category words onto yours",
      "Pagination, priority and the sitemap",
    ],
    facts: [
      { point: "Twelve departments with sections cover 32 products without a dead end", evidence: "commerce/catalogue/site.ts" },
      { point: "30+ supplier category aliases map onto the 12 departments, so nothing lands in an \"other\" bucket", evidence: "commerce/src/siteModel.ts" },
      { point: "4 empty departments ship as real pages with noindex,follow — the tile still works, the sitemap stays clean", evidence: "commerce/catalogue/scripts/build-site.mts" },
    ],
    proof: ["commerce/catalogue/site.ts", "commerce/src/siteModel.ts", "commerce/catalogue/scripts/build-site.mts"],
    capability: "supplier-catalogue",
  },
  {
    slug: "returns-are-marketing",
    title: "Returns are a marketing channel, and most UK shops treat them as a cost",
    promise:
      "A shopper who returns something easily buys again; a shopper who fights you tells everyone. The portal is cheaper than the review.",
    query: "returns policy conversion rate",
    audience: "Shop owners whose returns process is an inbox",
    service: "e-commerce",
    status: "outline",
    words: 1200,
    outline: [
      "19.3% of online sales come back",
      "77% of good-return shoppers buy again; 71–89% of bad ones do not",
      "UK exchange conversion 5.8% vs 17.1% in the US — a design gap",
      "The 30-day policy that fits inside the law and above it",
      "What to put on the product page",
    ],
    facts: [
      { point: "Online returns are ~19.3% of sales", evidence: "2025 retail returns data" },
      { point: "77% would buy again after a good return; 71–89% would not after a bad one", evidence: "returns experience studies" },
      { point: "UK merchants convert returns into exchanges at 5.8% against 17.1% in the US", evidence: "returns platform benchmarks" },
    ],
    proof: ["commerce/src/catalog.ts", "commerce/src/seo.ts", "commerce/GAPS.md"],
    capability: "store-core",
  },
  {
    slug: "why-we-open-a-pr",
    title: "Why every change we make opens a pull request first",
    promise:
      "A build you cannot review is a build you cannot trust. Pull requests, checks and a named owner are the cheapest quality system there is.",
    query: "website change management process agency",
    audience: "Business owners who have been burned by a freelancer editing live",
    service: "business-automation",
    status: "outline",
    words: 1400,
    outline: [
      "The failure: changes nobody can see, on a site nobody can rebuild",
      "What a pull request actually gives a non-developer: a diff, a preview, a checklist",
      "Checks as the argument: 66 site tests, 79 studio, 119 commerce",
      "The merge gate, and why the tool is not allowed to merge itself",
      "What this costs, and when it is overkill",
    ],
    facts: [
      { point: "4 tabs draft work; 0 of them can merge it — the gate is a human clicking the green button", evidence: "studio/src/App.tsx, studio/README.md" },
      { point: "Preflight catches 4 classes of failure before a branch exists: collisions, missing dependencies, missing files, unresolved imports", evidence: "studio/src/installer.ts preflight" },
      { point: "A build is deterministic: 32 CSV rows in, 50 pages out, 0 validation issues", evidence: "commerce/catalogue/scripts/build-site.mts" },
    ],
    proof: ["studio/src/processDoc.ts", "studio/src/installer.ts", "studio/PROCESSES.md"],
    capability: "storage-kv",
  },
  {
    slug: "buy-dont-build",
    title: "Buy the boring parts: four things no small business should build itself",
    promise:
      "Payments, analytics, a CMS and a marketplace integration are all worse when hand-built — and none of them is your differentiator.",
    query: "custom website vs off the shelf small business",
    audience: "Owners weighing a bespoke build against a template",
    service: "website-design",
    status: "outline",
    words: 1300,
    outline: [
      "The four things not to build, and what to use instead",
      "Never handle a card number: hosted checkout, always",
      "Static pages generated from data beat a CMS for speed and crawlability",
      "Buy the analytics; spend the time on checkout",
      "The one thing worth building yourself: how you describe the product",
    ],
    facts: [
      { point: "0 reasons to handle a card number yourself: Stripe Checkout, Adyen or PayPal take that liability", evidence: "commerce/GAPS.md 'Things not to build'" },
      { point: "50 static pages from 1 CSV beat a CMS for speed and crawlability", evidence: "commerce/catalogue/scripts/build-site.mts" },
      { point: "A marketplace sync before order 1 automates a 2-minute job you do twice a day", evidence: "commerce/GAPS.md" },
    ],
    proof: ["commerce/GAPS.md", "commerce/README.md"],
    capability: "store-core",
  },
  {
    slug: "fixed-price-website",
    title: "What a fixed-price website should include (and what 'from £795' must not hide)",
    promise:
      "A fixed price is only honest if the scope is enumerated: pages, revisions, hosting, analytics, accessibility, and who owns the code.",
    query: "fixed price website design uk what included",
    audience: "Buyers comparing agency quotes",
    service: "website-design",
    status: "outline",
    words: 1500,
    outline: [
      "Why hourly billing punishes the client for asking questions",
      "The scope list we would put in writing: pages, revisions, devices, hosting, handover",
      "Accessibility and speed as deliverables with numbers attached",
      "Who owns the repository, the domain and the analytics",
      "Deposit, milestones and what happens if the brief changes",
    ],
    facts: [
      { point: "94% of audited European ecommerce journeys fail WCAG checks", evidence: "accessibility audits" },
      { point: "Tap targets below 24px and unlabelled fields are the common failures", evidence: "commerce/src/budget.ts auditMarkup" },
      { point: "Performance budgets can be written into the build: LCP ≤2.0s, ≤120kB JS", evidence: "commerce/src/budget.ts" },
    ],
    proof: ["commerce/src/budget.ts", "studio/PROCESSES.md"],
    capability: "store-core",
  },
  {
    slug: "llms-txt-worth-it",
    title: "llms.txt in practice: what we shipped, and what it changed",
    promise:
      "One plain-text file that states prices, delivery and policies is cheap, honest, and the easiest honest experiment in AI visibility you can run this week.",
    query: "llms.txt example",
    audience: "Technical marketers and agencies",
    service: "ai-automation",
    status: "outline",
    words: 900,
    outline: [
      "What llms.txt is, and the argument against it",
      "What goes in ours: canonical, facts, prices, policies, product links",
      "llms-full.txt: the whole catalogue for a crawler that wants it",
      "How to measure whether it matters without lying to yourself",
      "What we would change now that it is shipped",
    ],
    facts: [
      { point: "2 files — llms.txt and llms-full.txt — generated from the same data as the 50 pages", evidence: "commerce/src/seo.ts llmsTxt" },
      { point: "Facts stated plainly in 6 lines: £3.95 delivery, free over £40, 30-day returns, VAT included", evidence: "commerce/catalogue/dist/llms.txt, generated" },
      { point: "robots.txt names 6 crawlers explicitly rather than relying on a wildcard", evidence: "commerce/catalogue/scripts/build-site.mts" },
    ],
    proof: ["commerce/src/seo.ts", "commerce/catalogue/scripts/build-site.mts"],
    capability: "static-seo-pages",
  },
  {
    slug: "testing-as-sales-proof",
    title: "What 287 tests look like to a client who cannot read code",
    promise:
      "Tests are the only claim in a proposal you can verify: they turn 'we care about quality' into a number that fails loudly when it is not true.",
    query: "how do i know my website was built properly",
    audience: "Buyers who cannot evaluate a codebase",
    service: "business-automation",
    status: "outline",
    words: 1100,
    outline: [
      "Why 'it works on my machine' is not a deliverable",
      "Three kinds of test this repo actually uses, with examples",
      "The browser walk: 390px, no overflow, every tap target ≥24px",
      "What a client can ask for: CI output, a preview URL, a test count",
      "What a test cannot prove, and how to check that part yourself",
    ],
    facts: [
      { point: "287 tests across three packages: 66 site, 102 studio, 119 commerce", evidence: "CI, this repository" },
      { point: "The 287 tests assert shopper behaviour: £39 caps applied, basket totals to the penny, search tolerance", evidence: "commerce/src/affiliate.test.ts, siteModel.test.ts" },
      { point: "3 CI jobs run on every pull request; the claim is reviewable before it is merged", evidence: "GitHub Actions, .github/workflows/ci.yml" },
    ],
    proof: [".github/workflows/ci.yml", "commerce/src/affiliate.test.ts", "studio/src/features.test.ts"],
    capability: "static-seo-pages",
  },
];

export const briefById = (slug: string) => BRIEFS.find((brief) => brief.slug === slug);

/** Stable order for the Atlas ring and the markdown file. */
export const briefsByService = () =>
  [...BRIEFS].sort((a, b) => a.service.localeCompare(b.service) || a.slug.localeCompare(b.slug));

export function briefsMarkdown(): string {
  const lines = [
    "# Blog plan for sitebuildup.co.uk",
    "",
    `${BRIEFS.length} posts, each written from a number this repository can prove. Generated from \`studio/src/atlasBriefs.ts\` — edit there, not here.`,
    "",
    "| Post | Query | Service | Status | Words |",
    "| --- | --- | --- | --- | --- |",
    ...BRIEFS.map(
      (brief) => `| [${brief.title}](#${brief.slug}) | \`${brief.query}\` | ${brief.service} | ${brief.status} | ${brief.words} |`
    ),
    "",
  ];
  for (const brief of BRIEFS) {
    lines.push(`<a id="${brief.slug}"></a>`, "", `## ${brief.title}`, "", `**Promise.** ${brief.promise}`, "");
    lines.push(`- Query: \`${brief.query}\``, `- Audience: ${brief.audience}`, `- Service page: /services/${brief.service}`, `- Length: ~${brief.words} words`, "");
    lines.push("**Outline**", "");
    for (const heading of brief.outline) lines.push(`1. ${heading}`);
    lines.push("", "**Evidence**", "");
    for (const fact of brief.facts) lines.push(`- ${fact.point} — *${fact.evidence}*`);
    lines.push("", `**Proof in the repo:** ${brief.proof.map((file) => `\`${file}\``).join(", ")}`, "");
    lines.push("---", "");
  }
  return lines.join("\n");
}
