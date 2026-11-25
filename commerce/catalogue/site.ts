/**
 * The shop's own facts: name, promises, departments.
 *
 * Kept in one file because everything else — the pages, the feed, the sitemap,
 * the structured data — is a consequence of these decisions. Change the brand
 * here and every page changes with it.
 */

export interface Department {
  id: string;
  label: string;
  /** One line for the tile and the page title. */
  blurb: string;
  /** Why the department exists — used on its landing page, not for decoration. */
  why: string;
  /** Sub-departments, as the big shops split them. */
  sections: string[];
}

export const BRAND = {
  name: "Ecommerce",
  legalName: "Ecommerce Ltd",
  tagline: "Home, garden and the useful things in between",
  description:
    "Considered homeware, garden and kitchen things at honest prices — free delivery over £40, 30 days to change your mind, and product pages that answer the question before you ask it.",
  url: "https://ecommerce-two-psi-13.vercel.app",
  email: "hello@ecommerce.example",
  phone: "+44 20 7946 0000",
  country: "GB",
  currency: "GBP" as const,
  /** Shown in the utility bar, the footer and every product's shipping details. */
  delivery: {
    freeOver: 4000,
    standard: 395,
    standardDays: [2, 3] as [number, number],
    express: 595,
    expressDays: [1, 2] as [number, number],
    cutOff: "2pm",
  },
  returns: { days: 30, free: true, summary: "Free returns for 30 days, label included in the box." },
  trust: [
    "Free delivery over £40",
    "30 days to change your mind",
    "Dispatched from UK warehouses",
    "Prices include VAT",
  ],
  /** The demo notice. It is on every page because the products are invented. */
  notice:
    "Demonstration catalogue: the brand, products and prices are invented to show the build. Nothing here can be bought.",
} as const;

/**
 * Twelve departments, laid out the way large shops do it. Departments with no
 * products yet are still shown — with an honest "coming soon" label rather
 * than a dead link — because a shop that hides half its taxonomy looks broken.
 */
export const DEPARTMENTS: Department[] = [
  {
    id: "home",
    label: "Home & Furniture",
    blurb: "Shelves, baskets and small furniture that earns its space.",
    why: "Homeware is the widest category in the catalogue and the one people browse rather than search. It leads the taxonomy for that reason.",
    sections: ["Shelving", "Baskets & storage", "Small furniture", "Cushions & throws", "Mirrors"],
  },
  {
    id: "kitchen",
    label: "Kitchen & Dining",
    blurb: "Boards, mugs and bottles built to be used daily.",
    why: "Kitchen is a repeat-purchase department: the same customer comes back for a second mug or a replacement board.",
    sections: ["Cookware", "Tableware", "Drinkware", "Utensils", "Food storage"],
  },
  {
    id: "garden",
    label: "Garden & Outdoor",
    blurb: "Planters, plant care and the things that live outside.",
    why: "Garden has the strongest seasonality in the catalogue, so it sits high in the navigation from March to September.",
    sections: ["Planters", "Plant care", "Garden tools", "Outdoor living", "Bird & wildlife"],
  },
  {
    id: "lighting",
    label: "Lighting",
    blurb: "Lamps and lighting that work at a desk and in a corner.",
    why: "Lighting is a small department with high average order value, and it is the easiest place to sell a second item with the first.",
    sections: ["Desk & task", "Floor & table", "Outdoor", "Bulbs & fittings", "Night lights"],
  },
  {
    id: "bedding",
    label: "Bedding & Bath",
    blurb: "Throws, towels and the soft things.",
    why: "Bedding brings the highest repeat rate in homeware, which makes it the natural home for a mailing list sign-up.",
    sections: ["Bedding", "Throws & blankets", "Towels", "Bathroom accessories", "Cushions"],
  },
  {
    id: "storage",
    label: "Storage & Organisation",
    blurb: "Baskets, boxes and the end of clutter.",
    why: "Storage is searched with intent — people arrive knowing the shelf they need to fill — so it gets a large share of its traffic from search.",
    sections: ["Baskets", "Boxes & bins", "Shelving", "Under-bed", "Kitchen storage"],
  },
  {
    id: "pets",
    label: "Pet Supplies",
    blurb: "Beds, bowls and practical things for animals.",
    why: "Pet buyers repeat more than any other group and complain less, which makes the department worth its shelf space.",
    sections: ["Beds", "Bowls & feeding", "Toys", "Grooming", "Travel"],
  },
  {
    id: "diy",
    label: "DIY & Tools",
    blurb: "The small tools that stop a job becoming a project.",
    why: "DIY brings in the tradesperson who buys twice: once for the job, once for the next one.",
    sections: ["Hand tools", "Fixings", "Painting", "Safety", "Garden tools"],
  },
  {
    id: "toys",
    label: "Toys & Kids",
    blurb: "Wooden toys and things that survive a two-year-old.",
    why: "Planned for the gifting season. It is listed now so the navigation does not have to be rebuilt in October.",
    sections: ["Wooden toys", "Craft", "Outdoor play", "Baby & toddler", "Books"],
  },
  {
    id: "electricals",
    label: "Electricals & Appliances",
    blurb: "Small appliances and the cables nobody enjoys buying.",
    why: "Higher value, higher return rate, and a warranty to honour — it needs the returns process working before it opens.",
    sections: ["Small appliances", "Heating & cooling", "Cables & charging", "Smart home", "Batteries"],
  },
  {
    id: "beauty",
    label: "Health & Beauty",
    blurb: "Bath, body and the quiet end of self-care.",
    why: "A natural companion to aromatherapy and bath ranges, and it is where the catalogue's fragrance lines already sit.",
    sections: ["Bath & body", "Aromatherapy", "Hair", "Skincare", "Gift sets"],
  },
  {
    id: "office",
    label: "Office & Stationery",
    blurb: "Desk things, paper things, and the pens that go missing.",
    why: "Small, cheap, high-margin add-ons that lift the basket on a homeware order.",
    sections: ["Desk accessories", "Notebooks", "Pens", "Filing", "Printer paper"],
  },
];

export const departmentById = (id: string) => DEPARTMENTS.find((entry) => entry.id === id);

/** Where a supplier's free-text category lands in this taxonomy. */
export const CATEGORY_ALIASES: Record<string, string> = {
  home: "home",
  furniture: "home",
  "home & furniture": "home",
  kitchen: "kitchen",
  "kitchen & dining": "kitchen",
  dining: "kitchen",
  garden: "garden",
  outdoor: "garden",
  "garden & outdoor": "garden",
  lighting: "lighting",
  lamps: "lighting",
  bedding: "bedding",
  bath: "bedding",
  "bedding & bath": "bedding",
  storage: "storage",
  organisation: "storage",
  organization: "storage",
  "storage & organisation": "storage",
  pets: "pets",
  "pet supplies": "pets",
  diy: "diy",
  tools: "diy",
  "diy & tools": "diy",
  toys: "toys",
  kids: "toys",
  "toys & kids": "toys",
  electricals: "electricals",
  appliances: "electricals",
  beauty: "beauty",
  "health & beauty": "beauty",
  office: "office",
  stationery: "office",
  "office & stationery": "office",
};

/**
 * Words shoppers use that the catalogue does not. Each entry adds the shopper's
 * word to the products whose category or title it maps onto, so a search for
 * "shelves" finds a shelf rack and a search for "couch" finds a sofa.
 */
export const SEARCH_SYNONYMS: { term: string; means: string[] }[] = [
  { term: "shelves shelving", means: ["shelf", "storage", "home"] },
  { term: "sofa couch settee", means: ["sofa", "furniture"] },
  { term: "rug mat carpet", means: ["rug", "mat", "home"] },
  { term: "cushion pillow", means: ["cushion", "pillow", "bedding"] },
  { term: "duvet quilt", means: ["duvet", "bedding"] },
  { term: "pots planters", means: ["planter", "pot", "garden"] },
  { term: "lights lamps", means: ["lamp", "light", "lighting", "sconce"] },
  { term: "mirrors", means: ["mirror"] },
  { term: "rugs", means: ["rug"] },
  { term: "bbq barbecue", means: ["outdoor", "garden"] },
  { term: "cutlery crockery", means: ["kitchen", "bowl", "dining"] },
  { term: "bin storage basket", means: ["storage", "basket"] },
  { term: "dog cat pet", means: ["pets", "pet"] },
  { term: "drill diy", means: ["diy", "tools"] },
];
