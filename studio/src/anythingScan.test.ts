import { describe, expect, it } from "vitest";
import { describeScan, toApps, type ScanFile } from "./anythingScan";
import { toScannedApp, scanAnything } from "../scripts/scan-anything";

const file = (overrides: Partial<ScanFile> = {}): ScanFile => ({
  scannedAt: "2026-11-20T10:00:00.000Z",
  ok: true,
  apps: [
    {
      id: "prj_1",
      name: "Kaysie",
      organizationName: "connorbdigital",
      platform: "web",
      modules: ["Home", "Prices"],
      moduleCount: 2,
      updatedAt: "2026-11-18T10:00:00Z",
    },
  ],
  counts: { projects: 1, parts: 2, unread: 0 },
  me: null,
  ...overrides,
});

describe("the inventory read at build time", () => {
  it("turns a scan file into apps with their parts and no invented fields", () => {
    const apps = toApps(file());
    expect(apps).toHaveLength(1);
    expect(apps[0]!.modules).toEqual(["Home", "Prices"]);
    expect(apps[0]!.moduleCount).toBe(2);
    expect(apps[0]!.url).toBeUndefined();
  });

  it("says nothing was read when the scan failed, in words rather than an empty list", () => {
    const apps = toApps(file({ ok: false, reason: "No Anything key was set for this build.", apps: [], counts: { projects: 0, parts: 0, unread: 0 } }));
    expect(apps).toEqual([]);
    expect(describeScan(file({ ok: false, reason: "No Anything key was set for this build." }))).toBe(
      "Not scanned at build: No Anything key was set for this build."
    );
  });

  it("counts apps and parts in the line the space shows", () => {
    expect(describeScan(file())).toBe("Read at build on 20 Nov 2026: 1 app, 2 parts.");
    expect(describeScan(file({ counts: { projects: 3, parts: 60, unread: 1 } }))).toMatch(/3 apps, 60 parts, 1 unread/);
  });
});

describe("what the scan reads from Anything", () => {
  it("keeps every file as a part, and the count the project reported", () => {
    const files = Array.from({ length: 41 }, (_, index) => ({ id: `f${index}`, name: `Part ${index + 1}`, moduleType: "component", path: null }));
    const app = toScannedApp(
      { id: "prj_1", name: "Kaysie", organizationName: "connorbdigital", updatedAt: "2026-11-18T10:00:00Z" },
      { platform: "both", files, latestPublishedUrl: "https://kaysie.example" }
    );
    expect(app.modules).toHaveLength(41);
    expect(app.moduleCount).toBe(41);
    expect(app.platform).toBe("both");
    expect(app.url).toBe("https://kaysie.example");
  });

  it("refuses a published URL that is not https", () => {
    const app = toScannedApp({ id: "prj_1", name: "A" }, { files: [], latestPublishedUrl: "http://plain.example" });
    expect(app.url).toBeUndefined();
    expect(app.moduleCount).toBe(0);
  });

  it("reports a missing key as a reason, without asking the network", async () => {
    const scan = await scanAnything({});
    expect(scan.ok).toBe(false);
    expect(scan.reason).toMatch(/No Anything key/);
    expect(scan.apps).toEqual([]);
  });
});
