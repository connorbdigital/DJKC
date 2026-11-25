/**
 * The shelf: what the project needs next, where the products come from, and the
 * accounts the work depends on.
 *
 * This is data, not markup, so three things stay true: every link is https and
 * carries the reason it is worth opening, every task says what it unblocks, and
 * a test can hold both to that. The sourcing links are the same ones written up
 * in `commerce/SUPPLIERS.md` — if they diverge, that is a bug.
 */

export type Effort = "S" | "M" | "L";
export type TodoState = "now" | "next" | "later";
export type TodoWhere = "studio" | "site" | "commerce" | "repo" | "ops";

export interface StudioTodo {
  id: string;
  title: string;
  /** What it unblocks, or what stays broken without it. */
  why: string;
  effort: Effort;
  where: TodoWhere;
  state: TodoState;
}

export interface StudioLink {
  label: string;
  href: string;
  /** Why you would open this, in one line. */
  note: string;
  group: LinkGroup;
}

export type LinkGroup = "supply" | "market" | "research" | "providers" | "this-project";

export const LINK_GROUP_LABEL: Record<LinkGroup, string> = {
  supply: "Where stock comes from",
  market: "Where you list it",
  research: "Reading worth doing",
  providers: "Accounts the work depends on",
  "this-project": "This project",
};

export const LINK_GROUP_NOTE: Record<LinkGroup, string> = {
  supply: "Feeds and wholesalers. Check carriage before pricing anything large.",
  market: "Marketplaces — the other direction: you send them products, they do not send you a catalogue.",
  research: "Third-party studies and documentation. Read the method before quoting a number.",
  providers: "What each account is for, and what stays broken until it exists.",
  "this-project": "The live site, the space, the repository and the documents that argue for themselves.",
};

export const LINKS: StudioLink[] = [
  {
    group: "supply",
    label: "Aosom B2B",
    href: "https://www.aosom.co.uk/page/business",
    note: "Wholesale arm of Homcom, Outsunny and Pawhut. Live feed with tiered trade pricing; big items, so check carriage first.",
  },
  {
    group: "supply",
    label: "Dropship For You",
    href: "https://www.dropshipforyou.co.uk/datafeed-downloads/",
    note: "Two documented UK feeds — products and stock — which is what the importer was built against.",
  },
  {
    group: "supply",
    label: "BigBuy",
    href: "https://www.bigbuy.eu",
    note: "400k+ SKUs, no minimum order, CSV/XML/API. Descriptions are shared with every other reseller.",
  },
  {
    group: "supply",
    label: "Avasam",
    href: "https://www.avasam.com",
    note: "UK dropship platform over a vetted supplier network; plain packaging, no invoice in the box.",
  },
  {
    group: "supply",
    label: "Something Different",
    href: "https://www.somethingdifferentdropship.co.uk",
    note: "Swansea giftware and homeware, trading since 1999. Same-day dispatch before 1pm.",
  },
  {
    group: "supply",
    label: "AW Dropship",
    href: "https://www.ancientwisdom.biz",
    note: "Sheffield gifts and home fragrance. Trade prices are login-only, so budgeting starts after approval.",
  },
  {
    group: "supply",
    label: "Costway UK",
    href: "https://www.costway.co.uk/dropship-with-costway",
    note: "Own-brand home and garden with UK warehouses; 10–12% discount by sales level.",
  },
  {
    group: "market",
    label: "The Range Marketplace",
    href: "https://marketplace.therange.co.uk/",
    note: "Application, not a CSV. The one most people mean when they say \"The Range dropship\".",
  },
  {
    group: "market",
    label: "OnBuy",
    href: "https://www.onbuy.com",
    note: "Cheapest UK marketplace to start on; thinner traffic than eBay or Amazon.",
  },
  {
    group: "market",
    label: "eBay UK",
    href: "https://www.ebay.co.uk",
    note: "Fastest route to a first sale; fees eat most of a thin margin.",
  },
  {
    group: "market",
    label: "Amazon UK",
    href: "https://sell.amazon.co.uk",
    note: "Largest audience, highest bar: compliance, brand, and a fee stack that suits volume only.",
  },
  {
    group: "market",
    label: "Wayfair Partners",
    href: "https://partners.wayfair.com",
    note: "Furniture and home only. Worth it if the catalogue goes heavy on one category.",
  },
  {
    group: "research",
    label: "Baymard Institute",
    href: "https://baymard.com/research/checkout-usability",
    note: "The reference work on checkout abandonment. Third-party research — not measured on this site.",
  },
  {
    group: "research",
    label: "Nielsen Norman Group",
    href: "https://www.nngroup.com/articles/",
    note: "Usability research that survives fashion. Good for justifying a design decision.",
  },
  {
    group: "research",
    label: "Shopify product data docs",
    href: "https://shopify.dev/docs/api/admin-graphql",
    note: "The schema a supplier feed ends up in, if the catalogue ever leaves this repo.",
  },
  {
    group: "research",
    label: "Stripe Checkout docs",
    href: "https://docs.stripe.com/payments/checkout",
    note: "The deposit pattern in api/deposit.ts is straight from here.",
  },
  {
    group: "providers",
    label: "GitHub fine-grained tokens",
    href: "https://github.com/settings/personal-access-tokens",
    note: "Where the Studio's key comes from: Contents read, Pull requests read/write, Checks read.",
  },
  {
    group: "providers",
    label: "Anthropic console",
    href: "https://console.anthropic.com/settings/keys",
    note: "ANTHROPIC_API_KEY — without it the Agent tab refuses to draft.",
  },
  {
    group: "providers",
    label: "Resend",
    href: "https://resend.com/api-keys",
    note: "RESEND_API_KEY — enquiry and booking emails. Without it the desk never hears about a booking.",
  },
  {
    group: "providers",
    label: "Stripe dashboard",
    href: "https://dashboard.stripe.com/apikeys",
    note: "STRIPE_SECRET_KEY — the priced booking form takes a deposit through it.",
  },
  {
    group: "providers",
    label: "Vercel KV",
    href: "https://vercel.com/docs/storage/vercel-kv",
    note: "KV_REST_API_URL and KV_REST_API_TOKEN — storage for bookings and sign-ups.",
  },
  {
    group: "providers",
    label: "OpenAI platform",
    href: "https://platform.openai.com/api-keys",
    note: "The site's chat widget. Vercel holds it as OPEN_AI_KEY and api/chat.ts now accepts both spellings, so it works without re-pasting a secret Vercel will not show again.",
  },
  {
    group: "this-project",
    label: "The site",
    href: "https://kaysie.sitebuildup.co.uk",
    note: "The live single-page site: priced enquiry form, booking desk, static pages generated for search.",
  },
  {
    group: "this-project",
    label: "The Studio",
    href: "https://studio-connorbdigital.vercel.app",
    note: "This app in production. Private: Vercel Authentication is on for every URL.",
  },
  {
    group: "this-project",
    label: "The repository",
    href: "https://github.com/connorbdigital/DJKC",
    note: "Everything here, including the documents below.",
  },
  {
    group: "this-project",
    label: "commerce/GAPS.md",
    href: "https://github.com/connorbdigital/DJKC/blob/main/commerce/GAPS.md",
    note: "What a real store has that this one does not, with an effort estimate for each gap.",
  },
  {
    group: "this-project",
    label: "commerce/SUPPLIERS.md",
    href: "https://github.com/connorbdigital/DJKC/blob/main/commerce/SUPPLIERS.md",
    note: "The sourcing write-up these links come from: formats, rough costs, and where each one hurts.",
  },
  {
    group: "this-project",
    label: "commerce/COMMISSION.md",
    href: "https://github.com/connorbdigital/DJKC/blob/main/commerce/COMMISSION.md",
    note: "Three routes to money, with the arithmetic for each.",
  },
];

export const TODOS: StudioTodo[] = [
  {
    id: "shop-stripe-key",
    title: "Put the Stripe key on the shop",
    why: "The checkout is built and prices every basket on the server, but with no STRIPE_SECRET_KEY it answers 503 and takes no card. One test key makes the whole path real; the live key needs the business verified first.",
    effort: "S",
    where: "commerce",
    state: "now",
  },
  {
    id: "shop-order-email",
    title: "Email the order, and write it down",
    why: "Stripe sends its own receipt; the shop sends nothing and records nothing. A webhook that writes the order and mails it is what turns a payment into an order someone can refund or re-send.",
    effort: "M",
    where: "commerce",
    state: "next",
  },
  {
    id: "shop-legal",
    title: "Write the four legal pages",
    why: "Privacy, terms of sale with the company details, cookies and an accessibility statement. Nothing in commerce/ generates them, and a shop without them cannot lawfully take an email.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "consent-analytics",
    title: "Measure the shop, with consent",
    why: "No analytics on either site, so every decision about the shop is a guess. Cookieless first, so there is nothing to consent to and nothing to leak.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "supplier-account",
    title: "Open one real supplier account",
    why: "SUPPLIERS.md documents ten feeds and the catalogue is invented. One free trade account and one sample order turns the pipeline into a shop.",
    effort: "M",
    where: "ops",
    state: "next",
  },
  {
    id: "band-case-studies",
    title: "Three case studies for SiteBuildup",
    why: "Every quote in the market is compared against proof. The band's site sells nothing yet because there is nothing on it that says what was built and what it did.",
    effort: "M",
    where: "ops",
    state: "next",
  },
  {
    id: "band-google-business",
    title: "Claim the Google Business Profile",
    why: "The strongest free lead source for a local service business, and SiteBuildup has no listing: searching \"web designer Leeds\" cannot find it.",
    effort: "S",
    where: "ops",
    state: "next",
  },
  {
    id: "anything-bridge",
    title: "Confirm the Anything bridge on the live Studio",
    why: "The bridge answers /api/anything?probe=1 with what each stored key is and what Anything says about it. The live answer was a 401 with two keys set, so one of the two variables is a wrong value.",
    effort: "S",
    where: "ops",
    state: "next",
  },
  {
    id: "rate-limit-chat",
    title: "Rate-limit /api/chat",
    why: "It is an unauthenticated endpoint that spends money on a public site. The only item here that can cost you overnight.",
    effort: "S",
    where: "site",
    state: "now",
  },
  {
    id: "anthropic-key",
    title: "Give the Studio's Agent a key on preview too",
    why: "ANTHROPIC_API_KEY is set for Production only, so the Agent works on the live Studio and refuses on every preview deployment — which is where a change gets tried first.",
    effort: "S",
    where: "ops",
    state: "now",
  },
  {
    id: "provision-site-keys",
    title: "Provision KV, ADMIN_TOKEN, Resend, Stripe, SITE_URL",
    why: "Every 'real' feature is built and inert without them: storage, the desk, email, deposits, and links in emails.",
    effort: "M",
    where: "ops",
    state: "now",
  },
  {
    id: "env-check",
    title: "Make a missing key fail loudly",
    why: "Today a missing variable looks like a quiet 'unavailable'. A startup check per endpoint would say which key is missing.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "sitemap",
    title: "sitemap.xml and robots.txt",
    why: "The pages are generated for search and then not listed. One file each.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "price-mismatch",
    title: "Reconcile £795 and £995",
    why: "The hero says 'from £795' and the services list says 'from £995'. Whichever is right, one of them is lying to a customer.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "brand-name",
    title: "Replace the demo name with the real one",
    why: "The shop is called Ecommerce because that is what the misspelling meant; when there is a trading name, it goes in commerce/catalogue/site.ts and every page follows.",
    effort: "S",
    where: "site",
    state: "next",
  },
  {
    id: "physical-device",
    title: "Walk the Atlas on a real phone",
    why: "Everything so far is emulated touch in desktop Chromium. It sends the same pointer events; it is not a phone.",
    effort: "S",
    where: "studio",
    state: "next",
  },
  {
    id: "real-photos",
    title: "Replace the placeholder photography",
    why: "The site sells a wedding DJ on invented images. This is the one gap no amount of code closes.",
    effort: "M",
    where: "site",
    state: "later",
  },
  {
    id: "deploys-tab",
    title: "A Deploys tab",
    why: "The Studio could answer 'is production live, and from which commit' itself instead of being asked.",
    effort: "M",
    where: "studio",
    state: "later",
  },
  {
    id: "projects-server-side",
    title: "Move your own Atlas projects to storage",
    why: "They live in one browser's localStorage. Behind KV they would follow you between machines, and a star could open a pull request.",
    effort: "M",
    where: "studio",
    state: "later",
  },
  {
    id: "vr-hardware",
    title: "Test the Atlas in a headset",
    why: "WebXR is wired and has only ever answered 'No headset'. Untested is not the same as working.",
    effort: "S",
    where: "studio",
    state: "later",
  },
  {
    id: "order-record",
    title: "Write an order down",
    why: "No order record means no refund, no support and no reporting — and a payment you will argue about.",
    effort: "M",
    where: "commerce",
    state: "later",
  },
];

export interface EnvKey {
  key: string;
  project: "studio" | "djkc";
  what: string;
  /** What a visitor sees when it is missing. */
  without: string;
}

/** The keys the two deployed projects read, and the honest consequence of a gap. */
export const ENV_KEYS: EnvKey[] = [
  { key: "ANTHROPIC_API_KEY", project: "studio", what: "Agent drafting", without: "the Agent tab refuses" },
  { key: "ANYTHING_API_KEY", project: "studio", what: "The /api/anything proxy: list your anything.com projects", without: "the Anything tab says it is not connected" },
  { key: "STUDIO_MODEL", project: "studio", what: "Optional model override", without: "claude-sonnet-4-5 is used" },
  { key: "GITHUB_TOKEN", project: "studio", what: "The /api/github proxy: browse without pasting a token", without: "the gate asks for one, as before" },
  { key: "KV_REST_API_URL", project: "djkc", what: "Storage, address", without: "bookings and sign-ups fail" },
  { key: "KV_REST_API_TOKEN", project: "djkc", what: "Storage, token", without: "bookings and sign-ups fail" },
  { key: "ADMIN_TOKEN", project: "djkc", what: "The booking desk", without: "the desk stays locked" },
  { key: "BOOKINGS_TOKEN", project: "djkc", what: "Booking export", without: "exports refused" },
  { key: "SUBSCRIBERS_TOKEN", project: "djkc", what: "Mailing-list export", without: "exports refused" },
  { key: "RESEND_API_KEY", project: "djkc", what: "Enquiry and booking email", without: "nobody is told" },
  { key: "NOTIFY_EMAIL", project: "djkc", what: "Where the alerts go", without: "no recipient" },
  { key: "NOTIFY_FROM", project: "djkc", what: "Verified sender", without: "provider rejects the mail" },
  { key: "STRIPE_SECRET_KEY", project: "djkc", what: "Deposits at booking", without: "no money moves" },
  { key: "STRIPE_DEPOSIT_PERCENT", project: "djkc", what: "Deposit percentage", without: "defaults to 50" },
  { key: "SITE_URL", project: "djkc", what: "Absolute links in email", without: "relative links, wrong share URL" },
  { key: "OPEN_AI_KEY", project: "djkc", what: "The chat widget (also read as OPENAI_API_KEY)", without: "'AI unavailable'" },
];

export const EFFORT_LABEL: Record<Effort, string> = {
  S: "small — a day",
  M: "medium — about a week",
  L: "large — a month or more",
};

export const STATE_LABEL: Record<TodoState, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
};

export const STATE_NOTE: Record<TodoState, string> = {
  now: "Costs money or blocks everything else.",
  next: "Cheap, useful, and unblocks the next round.",
  later: "Worth doing, but nothing depends on it yet.",
};

export function todosByState(state: TodoState): StudioTodo[] {
  return TODOS.filter((todo) => todo.state === state);
}

export function linksByGroup(group: LinkGroup): StudioLink[] {
  return LINKS.filter((link) => link.group === group);
}

/** Everything on the shelf as Markdown, for pasting into a brief or an issue. */
export function shelfAsMarkdown(): string {
  const states: TodoState[] = ["now", "next", "later"];
  const todoText = states
    .map((state) => {
      const rows = todosByState(state).map(
        (todo) => `- [ ] **${todo.title}** (${todo.effort}, ${todo.where}) — ${todo.why}`
      );
      return `### ${STATE_LABEL[state]} — ${STATE_NOTE[state]}\n\n${rows.join("\n")}`;
    })
    .join("\n\n");
  const groups = (Object.keys(LINK_GROUP_LABEL) as LinkGroup[])
    .map((group) => {
      const rows = linksByGroup(group).map((link) => `- [${link.label}](${link.href}) — ${link.note}`);
      return `### ${LINK_GROUP_LABEL[group]}\n\n${LINK_GROUP_NOTE[group]}\n\n${rows.join("\n")}`;
    })
    .join("\n\n");
  return `## The shelf\n\n${todoText}\n\n## Links\n\n${groups}`;
}
