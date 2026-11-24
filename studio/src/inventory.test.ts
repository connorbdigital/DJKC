import { describe, expect, it } from "vitest";
import { detectStack, summariseInventory, takeInventory } from "./inventory";

const paths = [
  "README.md",
  "package.json",
  "index.html",
  "api/store.ts",
  "api/bookings.ts",
  "api/notify.ts",
  "src/components/Booking.tsx",
  "src/components/Icons.tsx",
  "src/components/Reveal.tsx",
  "src/data.ts",
  "src/utils/dates.ts",
  "studio/features.json",
  ".github/workflows/ci.yml",
  "tests/booking.test.ts",
];

const packageJson = JSON.stringify({
  dependencies: { react: "19.0.0", stripe: "17.0.0" },
  devDependencies: { vite: "7.0.0", typescript: "5.9.0", vitest: "4.0.0" },
});

const manifest = JSON.stringify({
  version: 1,
  features: [
    { id: "storage-kv", name: "Vercel KV storage layer", version: "1.0.0" },
    { id: "booking-form-deposits", name: "Booking form with Stripe deposits", version: "1.0.1" },
  ],
});

describe("project inventory", () => {
  const inventory = takeInventory({ paths, packageJson, manifest });

  it("counts what is there", () => {
    expect(inventory.files).toBe(paths.length);
    expect(inventory.apiRoutes).toEqual(["api/bookings.ts", "api/notify.ts", "api/store.ts"]);
    expect(inventory.pages).toEqual(["index.html"]);
    expect(inventory.componentCount).toBe(3);
    expect(inventory.testCount).toBe(1);
    expect(inventory.docs).toContain("README.md");
  });

  it("reads the stack from dependencies and from what only exists as files", () => {
    expect(inventory.stack).toEqual(expect.arrayContaining(["React", "Vite", "TypeScript", "Vitest", "Stripe"]));
    expect(detectStack(["api/x.ts"], [])).toEqual(["Vercel functions"]);
    expect(detectStack([], [])).toEqual([]);
    expect(detectStack(["index.html"], [])).toEqual(["Static files"]);
  });

  it("names the feature and the file that proves it", () => {
    const storage = inventory.features.find((feature) => feature.id === "storage-kv");
    expect(storage?.evidence).toEqual(["api/store.ts"]);
    expect(storage?.unrecorded).toBe(false);
    const form = inventory.features.find((feature) => feature.id === "booking-form-deposits");
    expect(form?.evidence).toContain("src/components/Booking.tsx");
    expect(form?.version).toBe("1.0.1");
  });

  it("calls out a feature that is present but not recorded", () => {
    const unrecorded = takeInventory({ paths, packageJson });
    const form = unrecorded.features.find((feature) => feature.id === "booking-form-deposits");
    expect(form?.unrecorded).toBe(true);
    expect(unrecorded.recorded).toEqual([]);
    expect(unrecorded.notes.join(" ")).toMatch(/detected from files alone/);
    expect(unrecorded.notes.join(" ")).toMatch(/not recorded by the Studio/);
  });

  it("knows what environment it expects, from the features rather than a guess", () => {
    expect(inventory.env).toEqual(expect.arrayContaining(["STRIPE_SECRET_KEY", "KV_REST_API_URL", "SITE_URL"]));
  });

  it("notes what a project is missing instead of implying it is fine", () => {
    const bare = takeInventory({ paths: ["index.html"], packageJson: null });
    expect(bare.notes).toEqual(
      expect.arrayContaining([
        "No CI workflow: nothing will check a pull request automatically.",
        "No tests found.",
        "No README or docs.",
      ])
    );
    expect(bare.notes.join(" ")).toMatch(/Nothing recorded/);
    expect(takeInventory({ paths, packageJson, manifest, truncated: true }).notes[0]).toMatch(/cut short/);
  });

  it("survives a broken package.json and a broken manifest", () => {
    const broken = takeInventory({ paths, packageJson: "{not json", manifest: "also not json" });
    expect(broken.stack).toEqual(["Vercel functions"]);
    expect(broken.recorded).toEqual([]);
  });

  it("writes a summary that could be pasted into a brief", () => {
    const summary = summariseInventory("connorbdigital/DJKC", inventory);
    expect(summary).toContain("connorbdigital/DJKC:");
    expect(summary).toContain("Routes: api/bookings.ts");
    expect(summary).toContain("Known features:");
    expect(summary).toContain("Needs: ");
    expect(summary.length).toBeLessThan(700);
  });
});
