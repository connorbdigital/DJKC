import { describe, expect, it } from "vitest";
import { auditSite, buildUniversal, classifyPage, FUNCTIONS, sourceFromPages, type Source } from "./universal";

const site = (id: string, label: string, pages: [string, string][]): Source =>
  sourceFromPages(
    id,
    label,
    "site",
    pages.map(([name, href]) => ({ label: name, href }))
  );

describe("classifyPage", () => {
  it("knows the pages a site actually has", () => {
    expect(classifyPage("Prices", "https://kaysie.sitebuildup.co.uk/prices.html")).toBe("pricing");
    expect(classifyPage("What a DJ costs", "https://kaysie.sitebuildup.co.uk/how-much-does-a-dj-cost.html")).toBe("pricing");
    expect(classifyPage("Questions", "https://kaysie.sitebuildup.co.uk/faq.html")).toBe("questions");
    expect(classifyPage("Live dates", "https://kaysie.sitebuildup.co.uk/shows.html")).toBe("availability");
    expect(classifyPage("About KC", "https://kaysie.sitebuildup.co.uk/about.html")).toBe("about");
    expect(classifyPage("Weddings", "https://kaysie.sitebuildup.co.uk/wedding-dj.html")).toBe("work");
    expect(classifyPage("DJ hire Manchester", "https://kaysie.sitebuildup.co.uk/dj-hire-manchester.html")).toBe("booking");
    expect(classifyPage("Where KC plays", "https://kaysie.sitebuildup.co.uk/coverage.html")).toBe("coverage");
    expect(classifyPage("Home", "https://kaysie.sitebuildup.co.uk/")).toBe("home");
  });

  it("reads a bare address as well as a name", () => {
    expect(classifyPage("", "https://example.com/privacy")).toBe("legal");
    expect(classifyPage("", "https://example.com/booking.html")).toBe("booking");
    expect(classifyPage("Page 2", "https://example.com/case-studies/booth")).toBe("work");
  });

  it("reads a fragment as part of what a link is for", () => {
    expect(classifyPage("Book the date", "https://k.example/index.html#booking")).toBe("booking");
    expect(classifyPage("", "https://k.example/#contact")).toBe("booking");
    expect(classifyPage("", "https://k.example/prices?utm_source=instagram")).toBe("pricing");
  });

  it("calls a nameless link to a front door the front door", () => {
    expect(classifyPage("", "https://example.com/")).toBe("home");
    expect(classifyPage("", "https://example.com")).toBe("home");
  });

  it("says nothing rather than guessing at nothing", () => {
    expect(classifyPage("", "https://example.com/xq7")).toBeNull();
    expect(classifyPage("Banana", "")).toBeNull();
  });

  it("resolves the ambiguous ones towards the specific word", () => {
    /* A wedding page is the work; a page about booking a wedding is the booking. */
    expect(classifyPage("Weddings", "https://example.com/weddings")).toBe("work");
    expect(classifyPage("Book a wedding", "https://example.com/book-a-wedding")).toBe("booking");
  });

  it("gives every function at least one word, and no function two ids", () => {
    const ids = new Set(FUNCTIONS.map((entry) => entry.id));
    expect(ids.size).toBe(FUNCTIONS.length);
    for (const entry of FUNCTIONS) {
      expect(entry.words.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.why.length).toBeGreaterThan(10);
    }
  });
});

describe("buildUniversal", () => {
  const sources: Source[] = [
    site("kc", "DJKC — the site", [
      ["Home", "https://kaysie.sitebuildup.co.uk/"],
      ["Prices", "https://kaysie.sitebuildup.co.uk/prices.html"],
      ["Questions", "https://kaysie.sitebuildup.co.uk/faq.html"],
      ["Live dates", "https://kaysie.sitebuildup.co.uk/shows.html"],
    ]),
    site("studio", "Studio — the builder", [
      ["Home", "https://studio-connorbdigital.vercel.app/"],
      ["Prices", "https://studio-connorbdigital.vercel.app/pricing"],
      ["Questions", "https://studio-connorbdigital.vercel.app/faq"],
    ]),
    site("shop", "The shop", [
      ["Home", "https://shop.example.com/"],
      ["Checkout", "https://shop.example.com/checkout"],
    ]),
  ];

  it("keeps only the functions that turn up more than once", () => {
    const universal = buildUniversal(sources);
    expect(universal.entries.map((entry) => entry.id)).toContain("pricing");
    expect(universal.entries.map((entry) => entry.id)).toContain("questions");
    /* Availability is in one source only: an example, not a rule. */
    expect(universal.entries.map((entry) => entry.id)).not.toContain("availability");
  });

  it("puts the most common first, and says who has it and who does not", () => {
    const universal = buildUniversal(sources);
    expect(universal.entries[0]!.coverage).toBeGreaterThanOrEqual(universal.entries.at(-1)!.coverage);
    const home = universal.entries.find((entry) => entry.id === "home")!;
    expect(home.coverage).toBe(3);
    expect(home.sourceCount).toBe(3);
    expect(home.everywhere).toBe(true);
    expect(home.have).toHaveLength(3);
    expect(home.lack).toHaveLength(0);

    const questions = universal.entries.find((entry) => entry.id === "questions")!;
    expect(questions.have).toEqual(["DJKC — the site", "Studio — the builder"]);
    expect(questions.lack).toEqual(["The shop"]);
    expect(questions.everywhere).toBe(false);
  });

  it("gives an example you can go and look at", () => {
    const universal = buildUniversal(sources);
    const pricing = universal.entries.find((entry) => entry.id === "pricing")!;
    expect(pricing.example?.href).toContain("/prices.html");
    expect(pricing.example?.source).toBe("DJKC — the site");
  });

  it("counts pages and parts, and says how many sources they came from", () => {
    const doubled = [
      site("a", "A", [
        ["Prices", "https://a.example/prices"],
        ["What it costs", "https://a.example/costs"],
      ]),
      site("b", "B", [["Prices", "https://b.example/pricing"]]),
    ];
    const universal = buildUniversal(doubled);
    const pricing = universal.entries.find((entry) => entry.id === "pricing")!;
    expect(pricing.coverage).toBe(3);
    expect(pricing.sourceCount).toBe(2);
    expect(pricing.have).toEqual(["A", "B"]);
  });

  it("does not call one page a pattern", () => {
    const single = [site("a", "A", [["Prices", "https://a.example/prices"]]), site("b", "B", [["Home", "https://b.example/"]])];
    expect(buildUniversal(single).entries).toEqual([]);
  });

  it("ignores a source with no pages at all when it says 'everywhere'", () => {
    const withEmpty = [...sources, sourceFromPages("empty", "An app with no parts read", "app", [])];
    const universal = buildUniversal(withEmpty);
    const home = universal.entries.find((entry) => entry.id === "home")!;
    expect(home.everywhere).toBe(true);
    expect(home.lack).not.toContain("An app with no parts read");
    expect(universal.sources.find((entry) => entry.id === "empty")!.functions).toEqual([]);
  });

  it("is empty, not wrong, when nothing has been read", () => {
    const universal = buildUniversal([]);
    expect(universal.entries).toEqual([]);
    expect(universal.sources).toEqual([]);
  });
});

describe("auditSite", () => {
  const universal = buildUniversal([
    site("a", "A", [
      ["Home", "https://a.example/"],
      ["Prices", "https://a.example/prices"],
      ["Questions", "https://a.example/faq"],
    ]),
    site("b", "B", [
      ["Home", "https://b.example/"],
      ["Prices", "https://b.example/pricing"],
      ["Questions", "https://b.example/faq"],
    ]),
  ]);

  it("separates what a site has from what it lacks, and names a page for each it has", () => {
    const result = auditSite(
      [
        { label: "Kaysie Cork", href: "https://k.example/" },
        { label: "Prices", href: "https://k.example/prices.html" },
      ],
      universal
    );
    expect(result.present.map((entry) => entry.id).sort()).toEqual(["home", "pricing"]);
    expect(result.present.find((entry) => entry.id === "pricing")!.page.href).toContain("prices.html");
    expect(result.missing.map((entry) => entry.id)).toEqual(["questions"]);
    expect(result.missing[0]!.why.length).toBeGreaterThan(10);
  });

  it("keeps pages it could not place apart from faults", () => {
    const result = auditSite(
      [
        { label: "Home", href: "https://k.example/" },
        { label: "Prices", href: "https://k.example/prices" },
        { label: "", href: "https://k.example/xq7" },
      ],
      universal
    );
    expect(result.unclassified).toEqual([{ label: "", href: "https://k.example/xq7" }]);
    expect(result.missing.map((entry) => entry.id)).toEqual(["questions"]);
  });

  it("says when it read too little to be worth reading", () => {
    expect(auditSite([{ label: "Home", href: "https://k.example/" }], universal).thin).toBe(true);
    expect(
      auditSite(
        [
          { label: "Home", href: "https://k.example/" },
          { label: "Prices", href: "https://k.example/prices" },
        ],
        universal
      ).thin
    ).toBe(false);
  });

  it("marks nothing down for a function no other site has", () => {
    const result = auditSite([{ label: "Home", href: "https://k.example/", }, { label: "Prices", href: "https://k.example/prices" }], universal);
    expect(result.missing.map((entry) => entry.id)).not.toContain("availability");
  });
});
