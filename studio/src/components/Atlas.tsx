import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AtlasEngine, THEMES, type AtlasTheme } from "../atlasEngine";
import { checkUrl, type SiteReport } from "../sitecheck";
import { loadAnythingApps, loadAnythingList, type AnythingApp } from "../anythingClient";
import { scanLine, scannedApps } from "../anythingScan";
import { lookFromStick, moveFromStick, stickVector } from "../sticks";
import { isIdle, pickGamepad, readGamepad, type GamepadInput } from "../gamepad";
import { NODE_NOTES_KEY, noteCount, parseNodeNotes, setNodeNote, type NodeNotes } from "../nodeNotes";
import { GIST_STORE_KEY, buildBundle, describeBundle, isGistId, mergeBundle, pullNotes, pushNotes } from "../notesSync";
import { getToken } from "../token";
import { plateLayout } from "../plate";
import { loadPlate } from "../plateClient";
import { plateCanvas } from "../plateDraw";
import ProjectSpace3D from "./ProjectSpace3D";
import { SiteThumb } from "./SiteThumb";
import {
  TOUR,
  auditAtlas,
  buildAtlas,
  customProjectId,
  parseCustomProjects,
  distance,
  hashForNode,
  kindColour,
  nodeFromHash,
  searchAtlas,
  type AtlasNode,
  type AuditFinding,
  type CustomProject,
  type District,
  type NodeKind,
} from "../atlas";

const KIND_DISTRICT: Record<NodeKind, District> = {
  capability: "library",
  pack: "packs",
  step: "builder",
  project: "projects",
  brief: "content",
  site: "gallery",
  app: "anything",
  todo: "shelf",
  link: "shelf",
  built: "shelf",
  component: "studio",
};

const FILTERS: { id: NodeKind | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "capability", label: "Processes" },
  { id: "pack", label: "Pathways" },
  { id: "project", label: "Projects" },
  { id: "step", label: "Builder" },
  { id: "brief", label: "Blog plan" },
  { id: "site", label: "Sites" },
  { id: "app", label: "Anything" },
  { id: "built", label: "Shipped" },
  { id: "todo", label: "To do" },
  { id: "link", label: "Links" },
  { id: "component", label: "Studio parts" },
];

const POSE_KEY = "atlas:pose";
const FEEL_KEY = "atlas:feel";

/** Look speeds, as multipliers of the house rate. */
export const LOOK_STEPS: { id: string; label: string; value: number }[] = [
  { id: "slow", label: "Slow", value: 0.6 },
  { id: "normal", label: "Normal", value: 1 },
  { id: "fast", label: "Fast", value: 1.7 },
];

interface Feel {
  look: number;
  theme: AtlasTheme;
  turbo: boolean;
}

/** A stored feel that no longer parses is a feel with the defaults. */
export function readFeel(): Feel {
  const fallback: Feel = { look: 1, theme: "nebula", turbo: false };
  try {
    const raw = JSON.parse(window.localStorage.getItem(FEEL_KEY) ?? "null") as Partial<Feel> | null;
    if (!raw || typeof raw !== "object") return fallback;
    return {
      look: typeof raw.look === "number" && raw.look > 0 ? raw.look : fallback.look,
      theme: raw.theme && raw.theme in THEMES ? raw.theme : fallback.theme,
      turbo: raw.turbo === true,
    };
  } catch {
    return fallback;
  }
}

function writeFeel(next: Partial<Feel>) {
  try {
    window.localStorage.setItem(FEEL_KEY, JSON.stringify({ ...readFeel(), ...next }));
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
}
const NOTES_KEY = "atlas:notes:v1";
const PROJECTS_KEY = "atlas:projects:v1";

function readProjects(): CustomProject[] {
  try {
    return parseCustomProjects(JSON.parse(window.localStorage.getItem(PROJECTS_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function writeProjects(projects: CustomProject[]) {
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
}

function readPose(): [number, number, number] | null {
  try {
    const raw = window.localStorage.getItem(POSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return parsed as [number, number, number];
    }
  } catch {
    /* Storage is a convenience here, never a requirement. */
  }
  return null;
}

/**
 * The Atlas — one space holding the projects, the process library, the packs
 * that install them, the blog plan for sitebuildup.co.uk, and live site panels.
 *
 * It is deliberately usable without a GitHub token: the structure is local data,
 * so a client can be given a link to the space before anyone has signed in.
 * `#atlas/<node id>` opens it looking at that node.
 */
export function Atlas({ onClose }: { onClose?: () => void }) {
  const [ownProjects, setOwnProjects] = useState<CustomProject[]>(() => (typeof window === "undefined" ? [] : readProjects()));
  /* The apps on anything.com arrive after the space has been drawn: the atlas
     rebuilds when they do, and the pose carries across, so nothing jumps. */
  /* Seeded from the build-time scan: the suns and their parts are in the bundle
     before this component asks anything of the network. */
  const [apps, setApps] = useState<AnythingApp[]>(() => scannedApps);
  /* Why there are no Anything suns, when there are none: a space with a hole in
     it and no explanation is worse than a space with a sentence. */
  const [anythingNote, setAnythingNote] = useState("");
  const [anythingTry, setAnythingTry] = useState(0);
  const atlas = useMemo(() => buildAtlas(ownProjects, apps), [ownProjects, apps]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnythingApps({ limit: 24, signal: controller.signal }).then(async (result) => {
      if (controller.signal.aborted) return;
      if (result.ok && result.apps.length) {
        setApps(result.apps);
        setAnythingNote("");
        return;
      }
      /* A live read that fails does not empty the space: the build already read
         the account, and the scan is the better inventory of the two. */
      if (scannedApps.length) {
        setAnythingNote(`Live read failed (${result.ok ? "an empty answer" : result.reason}). ${scanLine()}`);
        return;
      }
      /* The detail calls are what make a sun's modules; the list is enough for
         the sun itself. So a failed detail is not a missing project. */
      const list = await loadAnythingList({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (list.ok && list.projects.length) {
        setApps(
          list.projects.slice(0, 24).map((project) => ({
            id: project.id,
            name: project.name,
            organizationName: project.organizationName,
            platform: "web",
            modules: [],
            updatedAt: project.updatedAt,
          }))
        );
        setAnythingNote(`${list.projects.length} Anything project${list.projects.length === 1 ? "" : "s"} in the space without their contents — the detail calls did not answer.`);
        return;
      }
      /* The bridge's own pulse turns "500" into a diagnosis: gone, keyless, or
         answering. It costs one GET and it is the difference between a number
         and a next step. */
      const pulse = await fetch("/api/anything")
        .then(async (response) => (await response.json()) as { bridge?: string; key?: string })
        .catch(() => null);
      const bridge =
        pulse?.bridge === "alive"
          ? ` The bridge is alive; its key is ${pulse.key === "set" ? "set" : "missing"}.`
          : " The bridge itself did not answer — open /api/anything to see why.";
      setAnythingNote(
        result.ok
          ? list.ok
            ? `Anything has no projects on this account yet.${bridge}`
            : `Anything: ${list.reason}.${bridge}`
          : `Anything: ${result.reason}.${bridge}`
      );
    });
    return () => controller.abort();
  }, [anythingTry]);
  const host = useRef<HTMLDivElement | null>(null);
  const cssHost = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  /* The element the detail board lives in. The engine carries it in the world;
     React renders into it, so the card in the space and the card in the corner
     are the same text. */
  const boardHost = useRef<HTMLDivElement | null>(null);
  const [boardReady, setBoardReady] = useState(false);
  const [wide, setWide] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 900));
  const engine = useRef<AtlasEngine | null>(null);
  const [selected, setSelected] = useState<AtlasNode | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  /* The node whose insides are open *in the space*, if any. */
  const [insideNode, setInsideNode] = useState<AtlasNode | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [filter, setFilter] = useState<NodeKind | "all">("all");
  const [position, setPosition] = useState<[number, number, number]>([0, 14, 78]);
  const [district, setDistrict] = useState<District>("library");
  const [near, setNear] = useState<string | null>(null);
  const [heading, setHeading] = useState("S");
  const [vr, setVr] = useState<"unknown" | "ready" | "none">("unknown");
  const [touch, setTouch] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tour, setTour] = useState<number | null>(null);
  const [space, setSpace] = useState<AtlasNode | null>(null);
  /* The head measures itself so everything below it can be placed under it
     rather than under a number that was true at one width with no note. */
  const headRef = useRef<HTMLDivElement>(null);
  /* `#atlas/stars` is a link you can send someone straight to the list. */
  const [stars, setStars] = useState<string | null>(() =>
    ["atlas/stars", "stars"].includes(window.location.hash.replace(/^#/, "")) ? "" : null
  );
  /* The feel of the place: how fast a look turns you, which of the three looks
     the room wears, and whether turbo is latched. Kept between visits, because
     a space that resets its own feel every time is a space you re-tune forever. */
  const [lookSpeed, setLookSpeed] = useState<number>(() => readFeel().look);
  const [theme, setTheme] = useState<AtlasTheme>(() => readFeel().theme);
  const [boosting, setBoosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [nodeNotes, setNodeNotes] = useState<NodeNotes>(() => {
    try {
      return parseNodeNotes(JSON.parse(window.localStorage.getItem(NODE_NOTES_KEY) ?? "{}"));
    } catch {
      return {};
    }
  });
  const [gistId, setGistId] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(GIST_STORE_KEY) ?? "";
      return isGistId(saved) ? saved : "";
    } catch {
      return "";
    }
  });
  const [gistBusy, setGistBusy] = useState(false);
  const [gistMessage, setGistMessage] = useState("");
  const [padOn, setPadOn] = useState(false);
  const padSeen = useRef(false);
  const setPadSeen = (seen: boolean) => {
    if (seen !== padSeen.current) {
      padSeen.current = seen;
      setPadOn(seen);
    }
  };
  const [saved, setSaved] = useState(true);
  const [notes, setNotes] = useState<string>(() => {
    try {
      return window.localStorage.getItem(NOTES_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const shell = useRef<HTMLDivElement | null>(null);
  /* A gamepad is polled, not listened to: the pad drives the same two inputs the
     sticks do, and only when the numbers actually change. */
  const padInput = useRef<GamepadInput | null>(null);
  const nearRef = useRef<string | null>(null);
  const jumpRef = useRef<(node: AtlasNode) => void>(() => {});
  const atlasNodesRef = useRef<AtlasNode[]>([]);
  const [panel, setPanel] = useState<"none" | "projects" | "audit" | "scan">("none");
  const [scanSite, setScanSite] = useState<AtlasNode | null>(null);
  const [findings, setFindings] = useState<AuditFinding[] | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteReport, setSiteReport] = useState<SiteReport | null>(null);
  const [siteError, setSiteError] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [draft, setDraft] = useState({ label: "", line: "", href: "", stack: "" });
  const savedAt = useRef(0);

  const results = useMemo(() => (query.trim() ? searchAtlas(atlas, query, 8) : []), [atlas, query]);

  useEffect(() => {
    setTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
  }, []);

  /* A note pinned to a node is short: it is written on every change, no pause. */
  useEffect(() => {
    try {
      window.localStorage.setItem(NODE_NOTES_KEY, JSON.stringify(nodeNotes));
    } catch {
      /* Storage is a convenience here, never a requirement. */
    }
  }, [nodeNotes]);

  /* Notes are written as you type, with a pause so a long sentence is one write
     rather than one per keystroke. */
  useEffect(() => {
    if (saved) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(NOTES_KEY, notes);
        setSaved(true);
      } catch {
        /* Storage full or blocked: the text is still here until the tab closes. */
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [notes, saved]);

  useEffect(() => {
    const sync = () => setWide(window.innerWidth >= 900);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const node = headRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height > 0) document.documentElement.style.setProperty("--atlas-head", `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--atlas-head");
    };
  }, []);

  useEffect(() => {
    if (!host.current || !cssHost.current || !stage.current) return;
    let instance: AtlasEngine | null = null;
    const fromHash = nodeFromHash(window.location.hash, atlas);
    try {
      instance = new AtlasEngine(
        host.current,
        cssHost.current,
        stage.current,
        atlas,
        {
          onSelect: (node) => {
            setSelected(node);
            /* A project is a star with an inside: clicking one opens its own
               space instead of only describing it in the panel. */
            if (node?.kind === "project" || node?.kind === "app") setSpace(node);
            /* Anything else that has pages can still be opened inside the Atlas
               with the button in the actions row. */
            /* A site opens on its plate, not on an iframe: the picture of the
               page is the point, and the live page is a button away. Loading it
               on selection meant the plate was never seen at all. */
          },
          onHover: (node) => setHovering(Boolean(node)),
          onInteract: () => setTour(null),
          onTick: (info) => {
            setPosition(info.position);
            setDistrict(info.district);
            setNear(info.near);
            setHeading(info.heading);
            /* A page unload does not always run a React cleanup, so the pose is
               written while you fly rather than only when the tab closes. */
            const now = Date.now();
            if (now - savedAt.current > 1000) {
              savedAt.current = now;
              try {
                window.localStorage.setItem(POSE_KEY, JSON.stringify(info.position.map((value) => Math.round(value))));
              } catch {
                /* Storage is a convenience here, never a requirement. */
              }
            }
          },
          onBoost: (on) => setBoosting(on),
          onStatus: (message) => setStatus(message),
          /* A node opened *in the space*: the HUD shows which one, and how to
             get back out of it. */
          onInside: (node) => setInsideNode(node),
        },
        fromHash ? null : readPose()
      );
      engine.current = instance;
      if (boardHost.current) {
        instance.attachBoard(boardHost.current);
        setBoardReady(true);
      }
      instance.setLookSpeed(readFeel().look);
      instance.setTheme(readFeel().theme);
      instance.setBoost(readFeel().turbo);
      setBoosting(readFeel().turbo);
      setReady(true);
      if (fromHash) {
        instance.flyToId(fromHash.id);
        setSelected(fromHash);
      }
    } catch (problem) {
      setFailed(
        problem instanceof Error
          ? `WebGL did not start: ${problem.message}. The list view below still has everything in the space.`
          : "WebGL did not start in this browser. The list view below still has everything in the space."
      );
    }
    void (navigator as Navigator & { xr?: XRSystem }).xr
      ?.isSessionSupported("immersive-vr")
      .then((supported) => setVr(supported ? "ready" : "none"))
      .catch(() => setVr("none"));
    return () => {
      /* Come back to where you were, not to the entrance. */
      try {
        const pose = instance?.getPose();
        if (pose) window.localStorage.setItem(POSE_KEY, JSON.stringify(pose.map((value) => Math.round(value))));
      } catch {
        /* Private browsing, quota, a locked-down WebView: none of it is fatal. */
      }
      instance?.dispose();
      engine.current = null;
    };
  }, [atlas]);

  useEffect(() => {
    engine.current?.setFilter(filter);
  }, [filter]);

  /* The plates: every site's own page, cut from the page, hung under its star —
     and the steps of the funnels we actually built, one below the last. Reads
     are queued three at a time and cached for the session, so arriving here
     does not open sixteen connections at once. A plate that fails is simply not
     hung: the star and its words are the space, the picture is the addition. */
  useEffect(() => {
    if (!ready) return;
    const instance = engine.current;
    if (!instance) return;
    let cancelled = false;

    type Job = { siteId: string; url: string; step?: number };
    const jobs: Job[] = [];
    for (const node of atlas.nodes) {
      if (node.kind !== "site" || !node.href) continue;
      jobs.push({ siteId: node.id, url: node.href });
      node.funnel?.forEach((step, index) => jobs.push({ siteId: node.id, url: step.url, step: index }));
    }

    const worker = async (job: Job) => {
      if (cancelled) return;
      const plate = await loadPlate(job.url);
      if (!plate || cancelled) return;
      const canvas = await plateCanvas(plateLayout(plate), plate.image);
      if (!canvas || cancelled) return;
      const picture = canvas.toDataURL("image/png");
      if (job.step === undefined) {
        instance.setPanelPlate(job.siteId, picture, `Cut from ${plate.url} — the page's own heading, colours and picture.`);
      } else {
        instance.setPanelStep(job.siteId, job.step, picture);
      }
    };

    void (async () => {
      const queue = [...jobs];
      const runners = Array.from({ length: 3 }, async () => {
        for (;;) {
          const job = queue.shift();
          if (!job || cancelled) return;
          await worker(job);
        }
      });
      await Promise.all(runners);
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, atlas]);

  /* A search should be visible in the dark, not just listed in the HUD. */
  useEffect(() => {
    if (!ready) return;
    if (results.length) engine.current?.highlightNodes(results.map((node) => node.id));
    else engine.current?.clearHighlight();
  }, [results, ready]);

  /* The tour: six stops, one sentence each, and any input hands control back. */
  useEffect(() => {
    if (tour === null) return;
    const stop = TOUR[tour];
    if (!stop) {
      setTour(null);
      return;
    }
    const centre = atlas.districts.find((place) => place.id === stop.district)?.centre;
    if (stop.node) engine.current?.flyToId(stop.node);
    else if (centre) engine.current?.focusDistrict(centre, stop.district === "content" ? 46 : 62);
    const timer = window.setTimeout(() => setTour((current) => (current === null ? null : current + 1)), 4200);
    return () => window.clearTimeout(timer);
  }, [tour, atlas]);

  const flyTo = useCallback((id: string) => {
    engine.current?.flyToId(id);
  }, []);

  const remember = (node: AtlasNode | null) => {
    const next = node ? `${window.location.pathname}${window.location.search}${hashForNode(node.id)}` : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", next);
  };

  const jump = (node: AtlasNode) => {
    flyTo(node.id);
    setSelected(node);
    remember(node);
  };

  const closeDetail = () => {
    setSelected(null);
    remember(null);
  };

  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  useEffect(() => {
    atlasNodesRef.current = atlas.nodes;
  }, [atlas]);

  /* A node link clicked while the space is already open has to open that node. */
  useEffect(() => {
    const sync = () => {
      const node = nodeFromHash(window.location.hash, atlas);
      if (node) {
        engine.current?.flyToId(node.id);
        setSelected(node);
      }
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [atlas]);

  /* The poll loop must outlive re-renders, so the handlers it calls come from refs. */
  useEffect(() => {
    jumpRef.current = jump;
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    if (typeof requestAnimationFrame !== "function") return;
    let raf = 0;
    let live = true;
    const tick = () => {
      if (!live) return;
      const pad = pickGamepad(navigator.getGamepads());
      setPadSeen(Boolean(pad));
      if (pad) {
        const next = readGamepad(pad, padInput.current);
        const was = padInput.current;
        padInput.current = next;
        const changed =
          !was ||
          was.move.forward !== next.move.forward ||
          was.move.strafe !== next.move.strafe ||
          was.look.x !== next.look.x ||
          was.look.y !== next.look.y ||
          was.lift !== next.lift ||
          was.boost !== next.boost;
        if (changed && !isIdle(next)) {
          engine.current?.setMoveInput({ forward: next.move.forward, strafe: next.move.strafe, lift: next.lift, boost: next.boost });
          engine.current?.setLookInput(next.look);
        } else if (changed && isIdle(next)) {
          engine.current?.setMoveInput({ forward: 0, strafe: 0, lift: 0, boost: false });
          engine.current?.setLookInput({ x: 0, y: 0 });
        }
        if (next.interact && nearRef.current) {
          const node = atlasNodesRef.current.find((entry) => entry.id === nearRef.current);
          if (node) jumpRef.current(node);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const copyLink = async (node: AtlasNode) => {
    const url = `${window.location.origin}${window.location.pathname}${hashForNode(node.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setStatus(`Copied ${url}`);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setStatus(url);
    }
  };

  const addProject = () => {
    const label = draft.label.trim();
    if (label.length < 2) {
      setStatus("Give the project a name of at least two characters.");
      return;
    }
    const project: CustomProject = {
      id: customProjectId(label),
      label,
      line: draft.line.trim(),
      stack: draft.stack
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      ...(draft.href.trim() ? { href: draft.href.trim() } : {}),
    };
    const next = [...ownProjects.filter((entry) => entry.id !== project.id), project];
    setOwnProjects(next);
    writeProjects(next);
    setDraft({ label: "", line: "", href: "", stack: "" });
    setPanel("none");
    setStatus(`${label} is in the projects district. It lives in this browser, not the repository.`);
  };

  const removeProject = (id: string) => {
    const next = ownProjects.filter((project) => project.id !== id);
    setOwnProjects(next);
    writeProjects(next);
    if (selected?.id === id) closeDetail();
  };

  const openAudit = () => {
    setFindings(auditAtlas(atlas));
    setPanel("audit");
  };

  const openScan = (node: AtlasNode) => {
    setScanSite(node);
    setSiteUrl(node.href ?? "");
    setSiteReport(null);
    setSiteError("");
    setPanel("scan");
  };

  useEffect(() => {
    if (panel === "none") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  const runSiteAudit = async () => {
    setSiteError("");
    setSiteReport(null);
    const verdict = checkUrl(siteUrl);
    if (!verdict.ok || !verdict.url) {
      setSiteError(verdict.reason ?? "That URL cannot be checked.");
      return;
    }
    setSiteBusy(true);
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: verdict.url.toString() }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true; report: SiteReport }
        | { ok: false; error: string }
        | null;
      if (!data) throw new Error(`The audit endpoint answered ${response.status}.`);
      if (!data.ok) throw new Error(data.error);
      setSiteReport(data.report);
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "The page could not be audited.";
      setSiteError(
        /404|405|unexpected token|failed to fetch|not found/i.test(message)
          ? "The audit runs on the deployed Studio (/api/site), not the dev server. Open the deployed URL to audit a page."
          : message
      );
    } finally {
      setSiteBusy(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const element = shell.current;
      if (!element?.requestFullscreen) {
        setStatus("This browser will not put a page full screen — on an iPhone, Share → Add to Home Screen gives the same effect.");
        return;
      }
      await element.requestFullscreen({ navigationUI: "hide" });
    } catch (problem) {
      setStatus(problem instanceof Error ? `Full screen was refused: ${problem.message}` : "Full screen was refused by the browser.");
    }
  };

  const downloadNotes = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const pinned = Object.entries(nodeNotes)
      .map(([id, text]) => `### ${atlas.nodes.find((node) => node.id === id)?.label ?? id}\n\n${text}\n`)
      .join("\n");
    const body = `# Atlas notes — ${stamp}\n\n${notes}\n${pinned ? `\n## Pinned to a node\n\n${pinned}` : ""}`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `atlas-notes-${stamp}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const syncPush = async () => {
    const token = getToken();
    if (!token) {
      setGistMessage("This studio has no token of yours in it, so there is no account to write the gist to.");
      return;
    }
    setGistBusy(true);
    setGistMessage("Writing the gist…");
    const result = await pushNotes(token, buildBundle(notes, nodeNotes), gistId || null);
    setGistBusy(false);
    if (!result.ok) {
      setGistMessage(result.error ?? "The push failed.");
      return;
    }
    if (result.gistId) {
      setGistId(result.gistId);
      try {
        window.localStorage.setItem(GIST_STORE_KEY, result.gistId);
      } catch {
        /* the gist still exists; this browser just will not remember it */
      }
    }
    setGistMessage("Pushed. The same gist will pull this back on another device.");
  };

  const syncPull = async () => {
    const token = getToken();
    if (!token) {
      setGistMessage("This studio has no token of yours in it, so there is nothing to read the gist with.");
      return;
    }
    if (!gistId) {
      setGistMessage("No gist yet on this device — push once to create one, and paste its id here if another device made it.");
      return;
    }
    setGistBusy(true);
    setGistMessage("Reading the gist…");
    const result = await pullNotes(token, gistId);
    setGistBusy(false);
    if (!result.ok || !result.bundle) {
      setGistMessage(result.error ?? "The pull failed.");
      return;
    }
    const merged = mergeBundle(buildBundle(notes, nodeNotes), result.bundle);
    setNotes(merged.notes);
    setNodeNotes(merged.nodeNotes);
    setSaved(false);
    setGistMessage(`Pulled — ${describeBundle(result.bundle)}.`);
  };

  const enterVr = async () => {
    if (!engine.current) return;
    try {
      const entered = await engine.current.enterVR();
      setStatus(entered ? "Headset connected. Trigger moves you along the ray; the panels stay on the screen view." : "No headset is connected to this browser.");
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : "The headset session did not start.");
    }
  };

  const goToDistrict = (id: District) => {
    const centre = atlas.districts.find((place) => place.id === id)?.centre;
    if (centre) engine.current?.focusDistrict(centre, id === "content" ? 34 : 58);
  };

  const districtInfo = atlas.districts.find((entry) => entry.id === district);
  const counts = atlas.nodes.reduce<Record<string, number>>((totals, node) => {
    totals[node.kind] = (totals[node.kind] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <div
      ref={shell}
      className={`atlas atlas-theme-${theme}${touch ? " is-touch" : ""}${hovering ? " is-hovering" : ""}${boosting ? " is-boosting" : ""}`}
    >
      <div className="atlas-stage" ref={stage}>
        <div ref={host} className="atlas-webgl" />
        <div ref={cssHost} className="atlas-css-host" />
        <div ref={boardHost} className="atlas-board" />
      </div>

      {/* The head: name, search, actions, the chips, and the search results, in
          one column. Every one of them used to be placed at a guessed offset from
          the top of the screen, so a long note under the title pushed the chips
          up underneath the search. In flow they cannot overlap, at any width. */}
      <div className="atlas-hud atlas-head" ref={headRef}>
      <div className="atlas-top">
        <div className="atlas-title">
          <p className="eyebrow">The Atlas</p>
          <strong>Everything the Studio knows, in one space</strong>
          {anythingNote && (
            <p className="atlas-note">
              {anythingNote}{" "}
              <button type="button" className="atlas-note-retry" onClick={() => setAnythingTry((count) => count + 1)}>
                Try again
              </button>
            </p>
          )}
        </div>

        <form
          className="atlas-search"
          onSubmit={(event) => {
            event.preventDefault();
            const [first] = results;
            if (first) jump(first);
            else if (query.trim()) setStatus(`Nothing in the space matches “${query.trim()}”. Try “checkout”, “delivery”, “AI” or “packs”.`);
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the space — a process, a pack, a blog post, a site…"
            aria-label="Search the atlas"
            enterKeyHint="go"
          />
          <button className="btn" type="submit">
            Fly to
          </button>
        </form>

        <div className="atlas-actions">
          {selected?.pages?.length ? (
            <button
              className="btn inside-open"
              type="button"
              onClick={() => engine.current?.openInside(selected.id)}
              title="Open it here, in the space: its landing page, its other pages, and its links running as streams"
            >
              ◎ Open in the space
            </button>
          ) : null}
          <button
            className="btn stars-open"
            type="button"
            onClick={() => {
              setStars("");
              setSpace(null);
            }}
            aria-expanded={stars !== null}
            title="Go to the stars — every project, then inside it"
          >
            ✷ Stars
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setTour(tour === null ? 0 : null)}
            aria-pressed={tour !== null}
            title="A guided six-stop flythrough"
          >
            {tour === null ? "Tour" : "Stop tour"}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setNotesOpen((open) => !open)}
            aria-pressed={notesOpen}
            title="A scratchpad for this space — saved on this device"
          >
            Notes{notes.trim() || noteCount(nodeNotes) ? " ·" : ""}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen}
            title="Fill the screen with the space"
          >
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
          <button
            className="btn ghost"
            type="button"
            data-desktop-only
            onClick={() => setPanel(panel === "projects" ? "none" : "projects")}
            aria-expanded={panel === "projects"}
            title="Add one of your own projects to the space"
          >
            ＋ Project
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => (panel === "audit" ? setPanel("none") : openAudit())}
            aria-expanded={panel === "audit"}
            title="Check the space and any site for real problems"
          >
            Audit
          </button>
          <button
            className="btn ghost"
            type="button"
            data-desktop-only
            onClick={() => void enterVr()}
            disabled={vr !== "ready"}
            title={vr === "ready" ? "Enter the space in a headset" : "No WebXR headset is attached to this browser"}
          >
            {vr === "ready" ? "Enter VR" : vr === "none" ? "No headset" : "VR…"}
          </button>
          {onClose && (
            <button className="btn ghost atlas-leave" type="button" onClick={onClose} title="Back to the Studio's 2D tabs">
              ← Studio (2D)
            </button>
          )}
        </div>
      </div>

      {insideNode && (
        <div className="atlas-hud atlas-inside-bar" role="status">
          <span className="atlas-inside-where">Inside</span>
          <strong>{insideNode.label}</strong>
          <span className="atlas-inside-what">its landing page, its other pages, and every link running between them</span>
          <button
            className="btn ghost"
            type="button"
            onClick={() => engine.current?.closeInside()}
          >
            ← Back to the space
          </button>
        </div>
      )}

      <div className="atlas-hud atlas-filters" role="group" aria-label="Show only">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${filter === entry.id ? " is-on" : ""}`}
            aria-pressed={filter === entry.id}
            onClick={() => {
              setFilter(entry.id);
              /* A chip is also a way of travelling: pick the district, go there. */
              if (entry.id !== "all") goToDistrict(KIND_DISTRICT[entry.id]);
            }}
          >
            {entry.label}
            <span>{entry.id === "all" ? atlas.nodes.length : counts[entry.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {query.trim() && !(touch && selected) && (
        <div className="atlas-hud atlas-results">
          {results.length === 0 && <p className="muted">Nothing matches “{query.trim()}”.</p>}
          {results.map((node) => (
            <button key={node.id} type="button" onClick={() => jump(node)}>
              <span className="swatch" style={{ background: kindColour[node.kind] }} />
              <span>
                <strong>{node.label}</strong>
                <small>{node.line.slice(0, 96)}</small>
              </span>
              <em>{distance(position, node.position)}m</em>
            </button>
          ))}
        </div>
      )}

      </div>

      {/* The feel tray: how a look turns you, which look the room wears, and turbo
          as a button rather than a key you have to remember. */}
      <div className="atlas-hud atlas-feel" role="group" aria-label="Feel">
        <div className="atlas-feel-row" data-desktop-only>
          <span className="atlas-feel-label">Look</span>
          {LOOK_STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              className={`atlas-feel-chip${lookSpeed === step.value ? " is-on" : ""}`}
              aria-pressed={lookSpeed === step.value}
              onClick={() => {
                setLookSpeed(step.value);
                engine.current?.setLookSpeed(step.value);
                writeFeel({ look: step.value });
              }}
            >
              {step.label}
            </button>
          ))}
        </div>
        <div className="atlas-feel-row" data-desktop-only>
          <span className="atlas-feel-label">Style</span>
          {(Object.keys(THEMES) as AtlasTheme[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`atlas-feel-chip${theme === id ? " is-on" : ""}`}
              aria-pressed={theme === id}
              title={`The room in the ${THEMES[id].label.toLowerCase()} look`}
              onClick={() => {
                setTheme(id);
                engine.current?.setTheme(id);
                writeFeel({ theme: id });
              }}
            >
              {THEMES[id].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`atlas-turbo${boosting ? " is-on" : ""}`}
          aria-pressed={boosting}
          title="Turbo — click it on, click it off (hold Shift for a burst)"
          onClick={() => {
            const next = !boosting;
            setBoosting(next);
            engine.current?.setBoost(next);
            writeFeel({ turbo: next });
          }}
        >
          <span className="atlas-turbo-dot" />
          Turbo
          <small>{boosting ? "on" : "off"}</small>
        </button>
      </div>

      <div className="atlas-hud atlas-map">
        <svg viewBox="-240 -240 480 480" role="group" aria-label="Map of the space — choose a district">
          <circle cx="0" cy="0" r="230" className="ring" />
          {atlas.districts.map((entry) => (
            <g key={entry.id} className="atlas-map-stop" onClick={() => goToDistrict(entry.id)} role="button" tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") goToDistrict(entry.id);
              }}>
              <title>{entry.label}</title>
              <circle cx={entry.centre[0]} cy={entry.centre[2]} r={district === entry.id ? 13 : 10} className={`district${district === entry.id ? " is-here" : ""}`} />
              <text x={entry.centre[0] + 16} y={entry.centre[2] + 4} className="district-label">
                {entry.label}
              </text>
            </g>
          ))}
          {atlas.nodes
            .filter((node) => ["project", "pack", "brief", "site", "capability"].includes(node.kind))
            .map((node) => (
              <circle
                key={node.id}
                cx={node.position[0]}
                cy={node.position[2]}
                r={node.id === selected?.id ? 5 : 2.4}
                fill={kindColour[node.kind]}
                opacity={node.id === selected?.id ? 1 : 0.7}
              />
            ))}
          <circle cx={position[0]} cy={position[2]} r="6" className="you" />
        </svg>
        <p>
          {districtInfo?.label ?? "Library"} · {heading} · {Math.round(position[0])}, {Math.round(position[2])}
        </p>
      </div>

      {stars !== null && (
        <section className="atlas-hud atlas-panel-sheet atlas-stars" aria-label="The stars — every project">
          <div className="atlas-sheet-head">
            <h2>The stars</h2>
            <input
              value={stars}
              onChange={(event) => setStars(event.target.value)}
              placeholder="Filter the projects…"
              aria-label="Filter the projects"
            />
            <button className="btn ghost" type="button" onClick={() => setStars(null)}>
              Close
            </button>
          </div>
          <p className="muted small">
            Every project in the space. <strong>Go in</strong> opens its own room: all its pages, and
            the links read off them.
          </p>
          <ul className="atlas-star-list">
            {atlas.nodes
              .filter((node) => {
                if (node.kind !== "project") return false;
                const needle = stars.trim().toLowerCase();
                return !needle || node.label.toLowerCase().includes(needle) || node.line.toLowerCase().includes(needle);
              })
              .map((node) => {
                const pages = node.pages?.length ?? 0;
                return (
                  <li key={node.id}>
                    <span className="atlas-star-name">
                      {node.label}
                      <em>
                        {pages} {pages === 1 ? "page" : "pages"}
                        {node.href ? ` · ${node.href.replace(/^https?:\/\//, "")}` : " · no address yet"}
                      </em>
                    </span>
                    <span className="atlas-star-actions">
                      <button className="btn ghost" type="button" onClick={() => jump(node)}>
                        Fly
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          flyTo(node.id);
                          setSelected(node);
                          remember(node);
                          setSpace(node);
                        }}
                      >
                        Go in
                      </button>
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {tour !== null && TOUR[tour] && (
        <div className="atlas-hud atlas-tour" role="status">
          <p className="eyebrow">
            Tour · {tour + 1}/{TOUR.length}
          </p>
          <p>{TOUR[tour].caption}</p>
          <div className="atlas-tour-actions">
            <button className="btn ghost" type="button" onClick={() => setTour(tour + 1)}>
              Next
            </button>
            <button className="btn ghost" type="button" onClick={() => setTour(null)}>
              Stop
            </button>
          </div>
        </div>
      )}

      {touch && (
        <div className="atlas-dock">
          <div className="atlas-stick">
            <Thumbstick label="Move — left stick" onChange={(vector) => engine.current?.setMoveInput(vector)} />
            <span className="atlas-stick-caption">Move</span>
          </div>
          <div className="atlas-dock-buttons">
            <button
              className="atlas-pad"
              type="button"
              aria-label="Rise"
              onPointerDown={() => engine.current?.setMoveInput({ lift: 1 })}
              onPointerUp={() => engine.current?.setMoveInput({ lift: 0 })}
              onPointerLeave={() => engine.current?.setMoveInput({ lift: 0 })}
            >
              ↑
            </button>
            <button
              className="atlas-pad"
              type="button"
              aria-label="Drop"
              onPointerDown={() => engine.current?.setMoveInput({ lift: -1 })}
              onPointerUp={() => engine.current?.setMoveInput({ lift: 0 })}
              onPointerLeave={() => engine.current?.setMoveInput({ lift: 0 })}
            >
              ↓
            </button>
            <button
              className={`atlas-pad is-boost${boosting ? " is-on" : ""}`}
              type="button"
              aria-label="Turbo"
              aria-pressed={boosting}
              title="Turbo — tap to latch, tap again to stop"
              onClick={() => {
                const next = !boosting;
                setBoosting(next);
                engine.current?.setBoost(next);
                writeFeel({ turbo: next });
              }}
            >
              ⚡
            </button>
          </div>
          <div className="atlas-stick">
            <Thumbstick
              label="Look — right stick"
              onChange={(vector) => engine.current?.setLookInput(lookFromStick({ x: vector.strafe, y: -vector.forward }))}
            />
            <span className="atlas-stick-caption">Look</span>
          </div>
        </div>
      )}

      <div className="atlas-hud atlas-help">
        <p>
          {touch ? (
            <>Drag to look · pinch to zoom · tap a node to inspect</>
          ) : (
            <>
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly · <kbd>Q</kbd><kbd>E</kbd> down/up · <kbd>Shift</kbd> boost ·
              drag to look · click a node to inspect · <kbd>F</kbd> fly to it · <kbd>Z</kbd><kbd>C</kbd> turn
            </>
          )}
        </p>
        {padOn && (
          <p className="atlas-pad-hint" role="status">
            Gamepad connected — left stick flies, right stick looks, <kbd>A</kbd> selects the nearest node,
            triggers boost, <kbd>LB</kbd>/<kbd>RB</kbd> drop and rise.
          </p>
        )}
        {near && <p className="near">Near: {near}</p>}
        <p className="atlas-build">build {__BUILD_TIME__}</p>
        {status && <p className="atlas-status">{status}</p>}
        {failed && <p className="error">{failed}</p>}
      </div>

      {/* The description, hung in the world. Same node, same words as the panel;
          the panel keeps the buttons and the note. */}
      {boardReady &&
        boardHost.current &&
        selected &&
        createPortal(
          <article className="atlas-board-card" style={{ borderColor: `${kindColour[selected.kind]}66` }}>
            <header>
              <span className="swatch" style={{ background: kindColour[selected.kind] }} />
              <p className="eyebrow">{selected.kind}</p>
              <button
                className="btn ghost"
                type="button"
                onClick={() => engine.current?.readBoard()}
                title="Fly up to the card and read it like a page"
              >
                Read it close
              </button>
            </header>
            <h2>{selected.label}</h2>
            <p className="atlas-board-line">{selected.line}</p>
            <div className="atlas-board-scroll">
              {selected.detail.split("\n\n").map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
              {selected.modules && selected.modules.length > 0 && (
                <div className="atlas-parts">
                  <p className="eyebrow">Every part inside it · {selected.modules.length}</p>
                  <ul>
                    {selected.modules.map((part) => (
                      <li key={part}>{part}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.bullets.length > 0 && (
                <ul className="atlas-board-bullets">
                  {selected.bullets.slice(0, 12).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
              {selected.sections?.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  <ul>
                    {section.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="atlas-board-foot">
                Scroll inside the card · wheel outside it to move · Esc closes · {nodeNotes[selected.id]?.trim() ? "you have a note on this" : "no note yet"}
              </p>
            </div>
          </article>,
          boardHost.current
        )}

      {selected && (
        <aside className="atlas-hud atlas-detail" aria-live="polite">
          <div className="atlas-detail-head">
            <span className="swatch" style={{ background: kindColour[selected.kind] }} />
            <p className="eyebrow">{selected.kind}</p>
            <button className="btn ghost" type="button" onClick={closeDetail} aria-label="Close details">
              ×
            </button>
          </div>
          <h2>{selected.label}</h2>
          <p className="atlas-detail-line">{selected.line}</p>
          {/* The description is on the board beside the node when there is a
              screen wide enough for one; the panel keeps the controls, your note
              and the links, and does not say the same thing twice. */}
          {boardReady && wide ? (
            <p className="muted small">
              Read it on the board beside the node · <button type="button" className="atlas-linkish" onClick={() => engine.current?.readBoard()}>read it close</button>
            </p>
          ) : (
            <>
              <p>{selected.detail}</p>
              {selected.modules && selected.modules.length > 0 && (
                <div className="atlas-parts">
                  <p className="eyebrow">Every part inside it · {selected.modules.length}</p>
                  <ul>
                    {selected.modules.map((part) => (
                      <li key={part}>{part}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selected.bullets.length > 0 && (
                <ul>
                  {selected.bullets.slice(0, 9).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {(selected.kind === "site" || selected.kind === "link") && selected.href && !sameOrigin(selected.href) && (
            <SiteThumb url={selected.href} label={selected.label} />
          )}

          <div className="atlas-section atlas-pin">
            <h3>Your note on this</h3>
            <textarea
              className="atlas-pin-field"
              value={nodeNotes[selected.id] ?? ""}
              onChange={(event) => setNodeNotes((current) => setNodeNote(current, selected.id, event.target.value))}
              placeholder="Something to remember about this node — kept in this browser."
              aria-label={`Your note on ${selected.label}`}
              rows={3}
            />
            {nodeNotes[selected.id]?.trim() ? (
              <p className="atlas-pin-foot">
                Pinned ·{" "}
                <button
                  type="button"
                  className="atlas-linkish"
                  onClick={() => setNodeNotes((current) => setNodeNote(current, selected.id, ""))}
                >
                  remove
                </button>
              </p>
            ) : (
              <p className="atlas-pin-foot muted">Saves as you type. Only this browser has it.</p>
            )}
          </div>

          {selected.pages && selected.pages.length > 0 && (
            <div className="atlas-section">
              <h3>Pages</h3>
              <ul className="atlas-pages">
                {selected.pages.map((page) => (
                  <li key={page.href}>
                    <a href={page.href} target="_blank" rel="noopener noreferrer">
                      {page.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.kind === "project" && selected.href && !sameOrigin(selected.href) && (
            <div className="atlas-section">
              <h3>The page itself</h3>
              <p className="muted small">
                If it stays blank, that site refuses to be framed — the links above still work.
              </p>
              <iframe
                className="atlas-detail-frame"
                src={selected.href}
                title={selected.label}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {selected.sections?.map((section) => (
            <div className="atlas-section" key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
          {onClose && (
            <p className="atlas-detail-escape">
              <a
                href="#tab=projects"
                onClick={(event) => {
                  event.preventDefault();
                  onClose();
                }}
              >
                Open this in the Studio (2D) ↗
              </a>
            </p>
          )}

          <div className="atlas-detail-actions">
            {(selected.kind === "project" || selected.kind === "app") && (
              <button className="btn" type="button" onClick={() => setSpace(selected)}>
                {selected.kind === "project" ? "Go inside ↗" : "What is inside ↗"}
              </button>
            )}
            <button className="btn" type="button" onClick={() => flyTo(selected.id)}>
              Fly to it
            </button>
            <button className="btn" type="button" onClick={() => engine.current?.diveTo(selected.id)}>
              Zoom in
            </button>
            {selected.kind === "site" && (
              <>
                <button className="btn ghost" type="button" onClick={() => engine.current?.loadSite(selected.id)}>
                  Preview in the space
                </button>
                <button className="btn ghost" type="button" onClick={() => engine.current?.restorePanel(selected.id)}>
                  Show the plate
                </button>
                <button className="btn" type="button" onClick={() => openScan(selected)}>
                  Scan it
                </button>
              </>
            )}
            <button className="btn ghost" type="button" onClick={() => void copyLink(selected)}>
              {copied ? "Copied" : "Copy link"}
            </button>
            {selected.href && (
              <a className="btn ghost" href={selected.href} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            )}
          </div>
        </aside>
      )}

      {notesOpen && (
        <section className="atlas-hud atlas-notes" aria-label="Notes">
          <div className="atlas-sheet-head">
            <h2>Notes</h2>
            <span className={`atlas-saved${saved ? "" : " is-dirty"}`}>{saved ? "Saved on this device" : "Saving…"}</span>
            <button className="btn ghost" type="button" onClick={() => setNotesOpen(false)} aria-label="Close notes">
              ×
            </button>
          </div>
          <textarea
            className="atlas-notes-field"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setSaved(false);
            }}
            placeholder="A price to check, a page to look at, a sentence for the brief…"
            aria-label="Notes, saved in this browser"
            rows={12}
          />
          <div className="atlas-notes-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => void navigator.clipboard?.writeText(notes).catch(() => setStatus("The browser refused the clipboard."))}
              disabled={!notes.trim()}
            >
              Copy
            </button>
            <button className="btn ghost" type="button" onClick={downloadNotes} disabled={!notes.trim()}>
              Download .md
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setNotes("");
                setSaved(false);
              }}
              disabled={!notes.trim()}
            >
              Clear
            </button>
            <span className="muted small">{notes.trim().length} characters</span>
          </div>
          <p className="atlas-sheet-note">
            Kept in this browser's local storage, like the pose and the projects you add yourself. Nothing is sent
            anywhere unless you ask it to be, below. <strong>Download</strong> is how you get it out: clearing site data
            clears this too.
          </p>

          <div className="atlas-sync">
            <h3>Across devices</h3>
            <p className="atlas-sheet-note">
              A <strong>secret gist</strong> on your own GitHub account is the copy: no database, nothing deployed, and the
              same token you signed in with can read it back on another machine. It needs the <code>gist</code> scope; if
              the token has not got it, GitHub says 403 and this says so rather than pretending.
            </p>
            <label className="atlas-sync-id">
              Gist id
              <input
                value={gistId}
                onChange={(event) => {
                  const next = event.target.value.trim();
                  setGistId(next);
                  try {
                    if (isGistId(next)) window.localStorage.setItem(GIST_STORE_KEY, next);
                  } catch {
                    /* not remembering it is survivable */
                  }
                }}
                placeholder="paste one from another device"
                spellCheck={false}
              />
            </label>
            <div className="atlas-notes-actions">
              <button className="btn" type="button" onClick={() => void syncPush()} disabled={gistBusy || (!notes.trim() && !noteCount(nodeNotes))}>
                {gistId ? "Push to the gist" : "Create a gist"}
              </button>
              <button className="btn ghost" type="button" onClick={() => void syncPull()} disabled={gistBusy || !gistId}>
                Pull
              </button>
            </div>
            {gistMessage && (
              <p className="atlas-sync-status" role="status">
                {gistMessage}
              </p>
            )}
          </div>
        </section>
      )}

      {panel === "projects" && (
        <section className="atlas-hud atlas-panel-sheet" aria-label="Add a project">
          <div className="atlas-sheet-head">
            <h2>Add a project</h2>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>
          <p className="atlas-sheet-note">
            These live in <strong>this browser</strong>, not in the repository — so they appear here and nowhere else, and
            nobody else sees them. The three built-in projects stay where they are.
          </p>
          <div className="atlas-form">
            <label>
              Name
              <input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Hilltop Cafe" maxLength={80} />
            </label>
            <label>
              What it is
              <input value={draft.line} onChange={(event) => setDraft({ ...draft, line: event.target.value })} placeholder="Menus, table bookings, a deposit taken at the door" maxLength={200} />
            </label>
            <label>
              Link (optional)
              <input value={draft.href} onChange={(event) => setDraft({ ...draft, href: event.target.value })} placeholder="https://hilltop.example" inputMode="url" />
            </label>
            <label>
              Stack (optional, comma separated)
              <input value={draft.stack} onChange={(event) => setDraft({ ...draft, stack: event.target.value })} placeholder="Astro, Stripe, Cloudflare" />
            </label>
            <button className="btn" type="button" onClick={addProject}>
              Put it in the space
            </button>
          </div>
          {ownProjects.length > 0 && (
            <ul className="atlas-own">
              {ownProjects.map((project) => (
                <li key={project.id}>
                  <button type="button" className="atlas-own-go" onClick={() => jump(atlas.nodes.find((node) => node.id === project.id) ?? atlas.nodes[0]!)}>
                    {project.label}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => removeProject(project.id)} aria-label={`Remove ${project.label}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {panel === "audit" && (
        <section className="atlas-hud atlas-panel-sheet atlas-audit" aria-label="Audit">
          <div className="atlas-sheet-head">
            <h2>Audit</h2>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>

          <div className="atlas-audit-block">
            <p className="atlas-sheet-note">
              <strong>The space.</strong> Mechanical checks over the same data the scene is built from: missing sources,
              dangling links, thin nodes, duplicate names, unreachable positions, and — on a machine with the repository —
              whether each post's proof file exists.
            </p>
            <p className="atlas-audit-tally">
              {findings === null
                ? "Not run."
                : findings.length === 0
                  ? "Nothing found."
                  : `${findings.filter((finding) => finding.severity === "high").length} high · ${findings.filter((finding) => finding.severity === "medium").length} medium · ${findings.filter((finding) => finding.severity === "low").length} low`}
            </p>
            {findings && findings.length > 0 && (
              <ul className="atlas-findings">
                {findings.map((finding) => (
                  <li key={finding.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (finding.node) {
                          const node = atlas.nodes.find((entry) => entry.id === finding.node);
                          if (node) jump(node);
                        }
                      }}
                    >
                      <span className={`severity is-${finding.severity}`}>{finding.severity}</span>
                      <strong>{finding.title}</strong>
                      <small>{finding.detail}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="atlas-audit-block">
            <p className="atlas-sheet-note">
              <strong>A page.</strong> Reads one public URL through <code>/api/site</code> and reports what it says about
              itself — title, description, one clear headline, structured data, alt text, viewport, canonical, share card
              and readable words. Nothing is crawled and nothing is stored.
            </p>
            <div className="atlas-scan-bar">
              <input
                value={siteUrl}
                onChange={(event) => setSiteUrl(event.target.value)}
                placeholder="https://example.co.uk"
                aria-label="URL to audit"
                inputMode="url"
              />
              <button className="btn" type="button" onClick={() => void runSiteAudit()} disabled={siteBusy}>
                {siteBusy ? "Reading…" : "Audit it"}
              </button>
            </div>
            {siteError && <p className="atlas-error">{siteError}</p>}
            {siteReport && (
              <div className="atlas-report">
                <p className="atlas-report-head">
                  <strong>{siteReport.title || "(no title)"}</strong> — {siteReport.words} words
                </p>
                <p className="atlas-sheet-note">{siteReport.description || "No meta description."}</p>
                <ul className="atlas-checks">
                  {siteReport.checks.map((check) => (
                    <li key={check.id} className={`is-${check.status}`}>
                      <span>{check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✕"}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                        {check.status !== "pass" && <small className="atlas-because">{check.because}</small>}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="atlas-sheet-note">{siteReport.verdict}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {panel === "scan" && scanSite && (
        <section className="atlas-hud atlas-scan" aria-label={`Scanning ${scanSite.label}`}>
          <div className="atlas-sheet-head">
            <span className="swatch" style={{ background: kindColour[scanSite.kind] }} />
            <h2>{scanSite.label}</h2>
            <a className="btn ghost" href={scanSite.href} target="_blank" rel="noopener noreferrer">
              Open in a tab
            </a>
            <button className="btn ghost" type="button" onClick={() => setPanel("none")} aria-label="Close">
              ×
            </button>
          </div>
          <p className="atlas-sheet-note">
            Scroll the page here, the way a visitor would. Sites that send <code>X-Frame-Options</code> or a
            <code> frame-ancestors</code> rule stay blank — that is the site refusing to be framed, not a broken reader,
            and the tab link is the way in.
          </p>
          {scanSite.href ? (
            <iframe className="atlas-scan-frame" src={scanSite.href} title={scanSite.label} loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <p className="atlas-error">This site has no address recorded.</p>
          )}
          <div className="atlas-scan-actions">
            <button className="btn" type="button" onClick={() => void runSiteAudit()}>
              Audit this page
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => {
                setSiteUrl(scanSite.href ?? "");
                setPanel("audit");
                setStatus("Run “Audit it” to check that page.");
              }}
            >
              Open the audit panel
            </button>
          </div>
        </section>
      )}

      {space && <ProjectSpace3D project={space} onClose={() => setSpace(null)} />}

      {!ready && !failed && <div className="atlas-hud atlas-loading">Building the space…</div>}
    </div>
  );
}

/** A thumbstick that reports the vector it is being pushed towards. */
/** A page cannot be shown inside itself: skip the preview for our own origin. */
function sameOrigin(href: string): boolean {
  try {
    return new URL(href, window.location.href).origin === window.location.origin;
  } catch {
    return true;
  }
}

function Thumbstick({
  onChange,
  label,
}: {
  onChange: (vector: { forward: number; strafe: number }) => void;
  label: string;
}) {
  const pad = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const update = (clientX: number, clientY: number) => {
    const box = pad.current?.getBoundingClientRect();
    if (!box) return;
    const radius = box.width / 2;
    const stick = stickVector(clientX - (box.left + radius), clientY - (box.top + radius), radius);
    setKnob({ x: stick.x * radius * 0.62, y: stick.y * radius * 0.62 });
    onChange(moveFromStick(stick));
  };

  const release = () => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onChange({ forward: 0, strafe: 0 });
  };

  return (
    <div
      ref={pad}
      className="atlas-thumb"
      role="group"
      aria-label={`${label} — drag the stick`}
      onPointerDown={(event) => {
        active.current = true;
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (active.current) update(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span className="atlas-thumb-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

/** The same space as a keyboard-and-screen-reader friendly list. */
export function AtlasList({ onPick }: { onPick?: (node: AtlasNode) => void }) {
  const atlas = useMemo(() => buildAtlas(), []);
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const visible = atlas.nodes.filter((node) => kind === "all" || node.kind === kind);
  return (
    <div className="atlas-list">
      <div className="atlas-filters" role="group" aria-label="Show only">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${kind === entry.id ? " is-on" : ""}`}
            aria-pressed={kind === entry.id}
            onClick={() => setKind(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <ul>
        {visible.map((node) => (
          <li key={node.id}>
            <span className="swatch" style={{ background: kindColour[node.kind] }} />
            <div>
              <button type="button" onClick={() => onPick?.(node)}>
                {node.label}
              </button>
              <p>{node.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
