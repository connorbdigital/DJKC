import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import type { AtlasNode } from "../atlas";
import { buildSpace, mergeLive, type Space } from "../atlasSpace";
import { knownPlate, loadPlate } from "../plateClient";
import { plateLayout } from "../plate";
import { plateTexture } from "../plateDraw";
import { arcPoints, framingFor, PLATE_HEIGHT, PLATE_WIDTH, ringLayout, ringRadius, toneFor, type Vec3 } from "../space3d";
import ProjectSpace from "./ProjectSpace";

/**
 * A project's own space, in three dimensions.
 *
 * The list beside it — `#stars`, the panel, every page by name — is the index.
 * This is the room: you stand inside the project, its front page is the sun you
 * are near, every other page is a star on a ring around you, and a page that has
 * a picture has it hanging behind its star like a poster in its own bay.
 *
 * Two rules carried over from the flat version, because they are the point of
 * it: a stream is a link **read off the page**, never a guess; and a page that
 * would not answer keeps its place on the ring and says so, rather than quietly
 * disappearing from a diagram that looks complete.
 */

interface ProjectSpace3DProps {
  project: AtlasNode;
  onClose: () => void;
}

type Reading = "idle" | "reading" | "read" | "failed";

const MAX_AUTO = 4;
const MAX_PLATES = 9;

const GLOW = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,.85)");
    gradient.addColorStop(0.28, "rgba(255,255,255,.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
})();

function labelSprite(text: string, colour = "#f6f1ff", size = 0.34): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `600 44px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  /* Twenty-two characters: a label is a name, and a name that runs the width of
     the room is a label nobody can place. */
  const shown = text.length > 22 ? `${text.slice(0, 21)}…` : text;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(shown).width) + 24;
  canvas.width = width;
  canvas.height = 64;
  const draw = canvas.getContext("2d")!;
  draw.font = font;
  draw.textBaseline = "middle";
  draw.fillStyle = colour;
  draw.fillText(shown, 12, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((width / 64) * size, size, 1);
  return sprite;
}

/**
 * A part of an app, as a hologram.
 *
 * An app has no pages, so there is no plate to hang and nothing to fetch: what it
 * has is a list of names — screens, components, functions. Drawn as a lit sheet of
 * glass with the name on it, hanging above its own star, that list becomes the
 * room's furniture: you can see at a glance what the app is made of, and the
 * sheets are the one thing in the room that always faces you.
 */
function holoCard(text: string, accent: string, index: number): THREE.Sprite {
  const width = 512;
  const height = 288;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  /* Glass, not paint: a diagonal wash that fades to almost nothing, so the stars
     behind a card are still there. */
  const wash = ctx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "rgba(30, 46, 82, 0.62)");
  wash.addColorStop(0.55, "rgba(16, 22, 44, 0.42)");
  wash.addColorStop(1, "rgba(9, 13, 26, 0.26)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.roundRect(6, 6, width - 12, height - 12, 22);
  ctx.fill();

  /* The rim, lit in the card's own colour, and a 1px white inner edge so it reads
     as glass rather than fog. */
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.lineWidth = 3;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.roundRect(6, 6, width - 12, height - 12, 22);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.34)";
  ctx.beginPath();
  ctx.roundRect(8.5, 8.5, width - 17, height - 17, 20);
  ctx.stroke();

  /* The accent bar and the part's number. */
  ctx.fillStyle = accent;
  ctx.fillRect(30, 30, 74, 5);
  ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = "rgba(220, 214, 242, 0.62)";
  ctx.fillText(String(index + 1).padStart(2, "0"), 30, 68);

  /* The name: three lines at most, shrinking a step when it needs to. */
  const lines: string[] = [];
  let size = 40;
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > width - 70 && line) {
      lines.push(line);
      line = word;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  while (lines.length > 3 && size > 24) {
    size -= 4;
    ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
    lines.length = 0;
    line = "";
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (ctx.measureText(attempt).width > width - 70 && line) {
        lines.push(line);
        line = word;
      } else {
        line = attempt;
      }
    }
    if (line) lines.push(line);
  }
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#f6f1ff";
  lines.slice(0, 3).forEach((entry, index_) => {
    ctx.fillText(entry, 30, 118 + index_ * (size + 8));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.0, 2.25, 1);
  return sprite;
}

function starfield(count = 900, spread = 260): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = spread * (0.35 + Math.random() * 0.65);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.abs(Math.cos(phi)) * radius * 0.6;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xbfc8ff, size: 0.5, transparent: true, opacity: 0.65, sizeAttenuation: true })
  );
}

export default function ProjectSpace3D({ project, onClose }: ProjectSpace3DProps) {
  const isApp = Boolean(project.modules?.length) && !project.pages?.length;
  const parts = useMemo(
    () => project.pages ?? (project.modules ?? []).map((label) => ({ label, href: "" })),
    [project.pages, project.modules]
  );
  const seed = useMemo(() => buildSpace(project.label, project.href ?? "", parts), [project.label, project.href, parts]);

  const [space, setSpace] = useState<Space>(seed);
  const [readings, setReadings] = useState<Record<string, Reading>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [plated, setPlated] = useState(0);
  const [view, setView] = useState<"room" | "list">("room");

  const mount = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const focus = useRef<(id: string | null) => void>(() => {});
  const zoom = useRef<(factor: number) => void>(() => {});
  /* The room is built once; these are the two things it hands back to React —
     the posters it can paint later, and the streams it redraws when reads land. */
  const plates = useRef(new Map<string, THREE.Mesh>());
  /* The real thing, not a drawing of it: a page's own markup, framed from this
     origin. `show` promotes a page to live, and the room remembers the order so
     it can drop the oldest when a sixth is asked for. */
  const show = useRef<(id: string) => void>(() => {});
  const [live, setLive] = useState(0);
  /* A picture is expensive and a room can be rebuilt: the textures outlive the
     scene, so coming back from the list does not reload nine pages. */
  const textures = useRef(new Map<string, THREE.Texture>());
  const redraw = useRef<(live: Space) => void>(() => {});
  const spaceRef = useRef(space);
  spaceRef.current = space;

  /* --------------------------------------------------------------- readings */
  const readOne = useCallback(async (href: string, id: string) => {
    if (!href) return;
    setReadings((current) => ({ ...current, [id]: "reading" }));
    let body: { ok?: boolean; links?: { label: string; href: string }[] } = {};
    try {
      const response = await fetch("/api/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: href, links: true }),
      });
      body = (await response.json()) as typeof body;
    } catch {
      body = {};
    }
    if (!body.ok || !Array.isArray(body.links)) {
      setReadings((current) => ({ ...current, [id]: "failed" }));
      return;
    }
    setReadings((current) => ({ ...current, [id]: "read" }));
    setSpace((current) => mergeLive(current, id, body.links!));
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const targets = [seed.hub, ...seed.nodes].filter((node) => node.href).slice(0, MAX_AUTO + 1);
      for (const node of targets) {
        if (!live) return;
        await readOne(node.href, node.id);
      }
    })();
    return () => {
      live = false;
    };
  }, [seed, readOne]);

  /* ------------------------------------------------------------------ plates */
  const paintPlate = useCallback((id: string, texture: THREE.Texture) => {
    const plate = plates.current.get(id);
    if (!plate) return;
    const material = plate.material as THREE.MeshBasicMaterial;
    if (material.map === texture && material.opacity === 1) return;
    material.map = texture;
    material.color.set("#ffffff");
    material.opacity = 1;
    material.needsUpdate = true;
    const frame = plate.userData.frame as THREE.LineSegments | undefined;
    if (frame) frame.visible = true;
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      /* The front page first: it is the picture you are standing in front of. */
      const withHref = [seed.hub, ...seed.nodes].filter((node) => node.href).slice(0, MAX_PLATES + 1);
      /* All of them at once. One after another, the last poster in a room of nine
         arrives twenty seconds after the room does, and the room looks empty while
         it waits. */
      await Promise.all(
        withHref.map(async (node) => {
          const plate = knownPlate(node.href) || (await loadPlate(node.href));
          if (!live || !plate) return;
          const texture = await plateTexture(plateLayout(plate), plate.image, { scale: 2 });
          if (!live || !texture) return;
          paintPlate(node.id, texture);
          setPlated((count) => count + 1);
        })
      );
    })();
    return () => {
      live = false;
    };
  }, [seed, paintPlate]);

  /* ------------------------------------------------------------------ scene */
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#06030c");
    scene.fog = new THREE.FogExp2(0x06030c, 0.012);

    const moduleNames = !project.pages?.length && project.modules?.length ? project.modules : null;
    /* An app's parts are sheets to read, so its ring closes in: the same radius
       that keeps nine posters apart puts twelve names too far away to read. */
    const ring = moduleNames ? Math.min(ringRadius(seed.nodes.length), 11) : ringRadius(seed.nodes.length);
    const framing = framingFor(ring);
    const camera = new THREE.PerspectiveCamera(framing.fov, 1, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    /* A second renderer, on top, for the one thing WebGL cannot draw: real HTML.
       CSS3D turns a div into a plane in the same scene, so a page's actual header
       hangs in the room beside the stars, and drags still reach the canvas because
       the layer takes no pointer events. */
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.domElement.style.position = "absolute";
    cssRenderer.domElement.style.inset = "0";
    cssRenderer.domElement.style.pointerEvents = "none";
    host.appendChild(cssRenderer.domElement);

    scene.add(starfield());

    /* A floor, so the ring has depth without a horizon line drawn through it. */
    const floor = new THREE.GridHelper(ring * 3.2, 24, 0x2a1c46, 0x171029);
    floor.position.y = -ring * 0.32;
    (floor.material as THREE.Material).transparent = true;
    (floor.material as THREE.Material).opacity = 0.35;
    scene.add(floor);

    const stars = new Map<string, THREE.Object3D>();
    const positions = new Map<string, Vec3>();
    const posterAt = new Map<string, { position: Vec3; width: number; height: number }>();

    /* The hub: the page you are standing next to. */
    const hubGeometry = new THREE.SphereGeometry(1.05, 32, 24);
    const hub = new THREE.Mesh(hubGeometry, new THREE.MeshBasicMaterial({ color: "#ff2bd6" }));
    hub.userData = { id: seed.hub.id };
    scene.add(hub);
    const hubGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: "#ff2bd6", transparent: true, opacity: 0.75, depthWrite: false }));
    hubGlow.scale.set(6, 6, 1);
    hub.add(hubGlow);
    stars.set(seed.hub.id, hub);
    positions.set(seed.hub.id, [0, 0, 0]);
    const hubLabel = labelSprite(seed.hub.label, "#ffd6f6", 0.52);
    hubLabel.position.set(0, -1.75, 0);
    scene.add(hubLabel);

    /* An app has parts, not pages: there is no picture to hang, so each part
       hangs itself — a hologram with its name on it, above its own star. */
    const cards: THREE.Sprite[] = [];

    /* The ring: one star, one poster, one label each. */
    const layout = ringLayout(seed.nodes.map((node) => node.id), { radius: ring });
    layout.forEach((item, index) => {
      const node = seed.nodes[index]!;
      const tone = toneFor(index, seed.nodes.length);
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(item.radius, 24, 18),
        new THREE.MeshBasicMaterial({ color: tone })
      );
      star.position.set(...item.position);
      star.userData = { id: node.id };
      scene.add(star);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: GLOW, color: tone, transparent: true, opacity: 0.55, depthWrite: false })
      );
      glow.scale.set(item.radius * 6, item.radius * 6, 1);
      star.add(glow);
      stars.set(node.id, star);
      positions.set(node.id, item.position);

      const label = moduleNames ? null : labelSprite(node.label, "#dcd6f2", 0.34);
      if (label) {
        label.position.set(item.position[0] * 1.06, item.position[1] - item.radius - 0.55, item.position[2] * 1.06);
        scene.add(label);
      }

      if (moduleNames) {
        /* A hologram above the star, and a hairline down to it, so the sheet
           belongs to the star it is hanging over. */
        const sprite = holoCard(moduleNames[index] ?? node.label, tone, index);
        /* Two heights, alternating: on one ring the sheets read as a fence. */
        const lift = item.radius + (index % 2 === 0 ? 1.15 : 1.95);
        sprite.position.set(item.position[0], item.position[1] + lift, item.position[2]);
        scene.add(sprite);
        cards.push(sprite);
        const thread = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(item.position[0], item.position[1] + item.radius, item.position[2]),
          new THREE.Vector3(item.position[0], item.position[1] + lift - 1.12, item.position[2]),
        ]);
        scene.add(new THREE.Line(thread, new THREE.LineBasicMaterial({ color: tone, transparent: true, opacity: 0.45 })));
        return;
      }

      /* The poster: dark glass until a picture arrives, so a page with no
         picture is a frame in the room rather than a hole in the wall. */
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(item.plate.width, item.plate.height),
        new THREE.MeshBasicMaterial({ color: "#150e28", transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      plate.position.set(...item.plate.position);
      plate.rotation.set(...item.plate.rotation);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(item.plate.width, item.plate.height)),
        new THREE.LineBasicMaterial({ color: "#8b5cf6", transparent: true, opacity: 0.55 })
      );
      plate.add(edges);
      plate.userData = { frame: edges, id: node.id };
      edges.visible = false;
      scene.add(plate);
      plates.current.set(node.id, plate);
      posterAt.set(node.id, { position: item.plate.position, width: item.plate.width, height: item.plate.height });
    });

    if (seed.hub.href && !moduleNames) {
      /* The front page has a poster too: a little bigger, straight ahead. */
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(PLATE_WIDTH * 1.15, PLATE_HEIGHT * 1.15),
        new THREE.MeshBasicMaterial({ color: "#150e28", transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      plate.position.set(0, 2.1, -2.2);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(PLATE_WIDTH * 1.15, PLATE_HEIGHT * 1.15)),
        new THREE.LineBasicMaterial({ color: "#ff2bd6", transparent: true, opacity: 0.5 })
      );
      edges.visible = false;
      plate.add(edges);
      plate.userData = { frame: edges };
      scene.add(plate);
      plates.current.set(seed.hub.id, plate);
      posterAt.set(seed.hub.id, {
        position: [0, 2.1, -2.2],
        width: PLATE_WIDTH * 1.15,
        height: PLATE_HEIGHT * 1.15,
      });
    }

    /* Streams. Redrawn whenever a page's links come back. */
    const streams = new THREE.Group();
    scene.add(streams);
    const drawStreams = (live: Space) => {
      for (const child of [...streams.children]) {
        streams.remove(child);
        (child as THREE.Line).geometry.dispose();
      }
      for (const edge of live.edges) {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) continue;
        const points = arcPoints(from, to, { segments: 28, bend: live.edges.length > 20 ? 0.14 : 0.2 });
        const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
        const material = new THREE.LineBasicMaterial({
          color: edge.source === "live" ? "#ff2bd6" : "#9fb0ff",
          transparent: true,
          opacity: edge.source === "live" ? 0.72 : 0.34,
        });
        streams.add(new THREE.Line(geometry, material));
      }
    };
    drawStreams(seed);
    redraw.current = drawStreams;

    /* ---------------------------------------------------------- the real pages */
    /* Five at once. A room with nine live iframes is nine pages loading at the
       reader's expense, and the posters already say what the rest look like. */
    const LIVE_W = 1200;
    const LIVE_H = 750;
    const MAX_LIVE = 5;
    const liveObjects = new Map<string, CSS3DObject>();
    const liveOrder: string[] = [];
    const makeLive = (id: string) => {
      const node = [seed.hub, ...seed.nodes].find((entry) => entry.id === id);
      const at = posterAt.get(id);
      if (!node?.href || !at || liveObjects.has(id)) return;
      const frame = document.createElement("div");
      frame.className = "space3d-live";
      frame.style.width = `${LIVE_W}px`;
      frame.style.height = `${LIVE_H}px`;
      const iframe = document.createElement("iframe");
      /* The page's own markup, fetched and made safe by /api/site?page=, so it can
         be shown even where the site refuses to be framed. Sandboxed with no
         allow-same-origin: even a script that survived the strip is an orphan.
         The read is done *before* the frame is pointed at it: a frame pointed at a
         refusal is a white rectangle in the middle of the room, and the poster
         behind it is better than that. */
      const source = `/api/site?page=${encodeURIComponent(node.href)}`;
      iframe.setAttribute("sandbox", "");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "no-referrer");
      iframe.setAttribute("title", `${node.label}, the page itself`);
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      iframe.style.background = "#0b0714";
      iframe.addEventListener("load", () => {
        frame.dataset.ready = "1";
      });
      frame.appendChild(iframe);
      const object = new CSS3DObject(frame);
      let cancelled = false;
      void fetch(source, { headers: { accept: "text/html" } })
        .then((response) => (response.ok ? response.text() : null))
        .then((html) => {
          if (cancelled || !html || !/<body/i.test(html)) {
            frame.remove();
            object.element.remove();
            scene.remove(object);
            liveObjects.delete(id);
            const at = liveOrder.indexOf(id);
            if (at >= 0) liveOrder.splice(at, 1);
            setLive(liveObjects.size);
            return;
          }
          iframe.srcdoc = html;
          frame.dataset.ready = "1";
        })
        .catch(() => {
          frame.remove();
          scene.remove(object);
          liveObjects.delete(id);
          setLive(liveObjects.size);
        });
      object.position.set(...at.position);
      object.scale.setScalar(at.width / LIVE_W);
      scene.add(object);
      liveObjects.set(id, object);
      liveOrder.push(id);
      while (liveOrder.length > MAX_LIVE) {
        const oldest = liveOrder.shift()!;
        const gone = liveObjects.get(oldest);
        if (!gone) continue;
        scene.remove(gone);
        gone.element.remove();
        liveObjects.delete(oldest);
      }
      setLive(liveObjects.size);
    };
    show.current = makeLive;
    /* The page you are standing next to, and the four after it, live from the
       start: the room should not open as a gallery of drawings. */
    [seed.hub, ...seed.nodes].filter((node) => node.href).slice(0, MAX_LIVE).forEach((node) => makeLive(node.id));
    for (const [id, texture] of textures.current) paintPlate(id, texture);

    /* ------------------------------------------------------------ the camera */
    let azimuth = 0;
    /* A flat ring seen from its own floor is a band across the middle of a
       portrait screen with two hundred pixels of nothing above it. On a phone
       the camera starts higher, so the ring opens into a disc. The aspect is only
       known once the stage has been measured, so this is decided in `resize`. */
    let polar = Math.PI / 2 - 0.34;
    let polarChosen = false;
    let distance = Math.abs(framing.position[2]);
    let goalAzimuth = azimuth;
    let goalPolar = polar;
    let goalDistance = distance;
    let dragging = false;
    let moved = 0;
    let last = { x: 0, y: 0 };

    /* The camera steps back until the ring *and* the posters behind it fit the
       narrower of the two fields of view. On a laptop the height is the limit; on
       a phone the width is, and the same distance that frames a ring on a laptop
       cuts a third of it off on a phone. */
    const apply = () => {
      const halfV = (camera.fov / 2) * (Math.PI / 180);
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      const need = (ring + PLATE_WIDTH * 1.25) / Math.tan(Math.min(halfV, halfH));
      const reach = Math.max(distance, need * 0.98);
      const y = Math.cos(polar) * reach;
      const flat = Math.sin(polar) * reach;
      camera.position.set(Math.sin(azimuth) * flat, y + ring * 0.12, Math.cos(azimuth) * flat);
      camera.lookAt(0, 0, 0);
    };
    apply();

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      cssRenderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!polarChosen) {
        polarChosen = true;
        if (camera.aspect < 0.85) {
          polar = 0.52;
          goalPolar = polar;
        }
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      last = { x: event.clientX, y: event.clientY };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (dragging) {
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        goalAzimuth -= dx * 0.005;
        goalPolar = Math.min(Math.PI / 2 + 0.45, Math.max(0.22, goalPolar - dy * 0.004));
        last = { x: event.clientX, y: event.clientY };
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...stars.values()], false);
      renderer.domElement.style.cursor = hits.length ? "pointer" : "grab";
    };
    const onUp = (event: PointerEvent) => {
      dragging = false;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...stars.values()], false);
      const hit = (hits[0]?.object.userData.id as string | undefined) ?? null;
      setSelected(hit);
      if (hit) makeLive(hit);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      goalDistance = Math.min(ring * 3.4, Math.max(ring * 0.35, goalDistance * (1 + Math.sign(event.deltaY) * 0.09)));
    };

    zoom.current = (factor) => {
      goalDistance = Math.min(ring * 3.4, Math.max(ring * 0.35, goalDistance * factor));
    };
    focus.current = (id) => {
      if (!id) {
        goalDistance = Math.abs(framing.position[2]);
        return;
      }
      const at = positions.get(id);
      if (!at) return;
      goalAzimuth = Math.atan2(at[0], at[2]);
      goalDistance = Math.max(ring * 0.55, 7);
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let frame = 0;
    let raf = 0;
    const loop = () => {
      frame += 1;
      azimuth += (goalAzimuth - azimuth) * 0.08;
      polar += (goalPolar - polar) * 0.08;
      distance += (goalDistance - distance) * 0.08;
      apply();
      for (const [id, star] of stars) {
        if (id === seed.hub.id) continue;
        const breathe = 1 + Math.sin(frame * 0.02 + id.length) * 0.035;
        star.scale.setScalar(breathe);
      }
      for (const [id, object] of liveObjects) {
        void id;
        object.quaternion.copy(camera.quaternion);
      }
      /* Posters turn to face you, by the shortest way. A picture of a page you
         have to walk round a room to read is a picture you do not read. */
      for (const [id, plate] of plates.current) {
        const angle = id === seed.hub.id ? 0 : Math.atan2(camera.position.x - plate.position.x, camera.position.z - plate.position.z);
        plate.rotation.set(id === seed.hub.id ? 0 : -0.06, angle, 0);
      }
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      redraw.current = () => {};
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      for (const object of liveObjects.values()) object.element.remove();
      liveObjects.clear();
      show.current = () => {};
      renderer.dispose();
      cssRenderer.domElement.remove();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material?.dispose?.();
      });
      plates.current.clear();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
    /* Built once per project, and rebuilt when the room is shown again after the
       list: the stage element is new each time, and an effect that did not re-run
       would leave it as an empty black rectangle. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, view, paintPlate]);

  /* Redraw the streams when the reads land. */
  useEffect(() => {
    redraw.current(space);
  }, [space]);

  const selectedNode = useMemo(
    () => [space.hub, ...space.nodes].find((node) => node.id === selected) ?? null,
    [space, selected]
  );

  useEffect(() => {
    if (selected) focus.current(selected);
  }, [selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selected) {
        event.stopPropagation();
        setSelected(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    shell.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onClose]);

  const counts = useMemo(() => {
    const total = space.nodes.length;
    const read = Object.values(readings).filter((state) => state === "read").length;
    const live = space.edges.filter((edge) => edge.source === "live").length;
    return { total, read, live };
  }, [space, readings]);

  if (view === "list") {
    return (
      <div className="space3d-list">
        <ProjectSpace project={project} onClose={onClose} />
        <button className="space-button quiet space3d-list-back" type="button" onClick={() => setView("room")}>
          Back to the room
        </button>
      </div>
    );
  }

  const stateOf = (id: string): string => {
    const node = [space.hub, ...space.nodes].find((entry) => entry.id === id);
    if (!node) return "";
    if (!node.href) return "a part of the app, not a page";
    const reading = readings[id] ?? "idle";
    if (reading === "reading") return "reading its links…";
    if (reading === "read") return `${space.edges.filter((edge) => edge.from === id).length} links read off it`;
    if (reading === "failed") return "it would not answer, so no links were drawn";
    return "not read yet";
  };

  return (
    <div className="space3d" ref={shell} tabIndex={-1} role="dialog" aria-label={`${project.label} in three dimensions`}>
      <header className="space3d-head">
        <div>
          <p className="space-kicker">{isApp ? "Inside the app" : "Inside the project"}</p>
          <h2>{project.label}</h2>
          <p className="space-meta">
            {isApp ? (
              <>
                {counts.total} parts, every one a hologram · {counts.read} read · {counts.live} streams read
                {live ? ` · the running app is live` : ""}
              </>
            ) : (
              <>
                {counts.total} pages · {counts.read} read · {counts.live} links read ·{" "}
                {live ? `${live} ${live === 1 ? "page" : "pages"} live` : "no pages live yet"} · {plated}{" "}
                {plated === 1 ? "picture" : "pictures"} hanging
              </>
            )}
          </p>
        </div>
        <div className="space-head-actions">
          {project.href && (
            <a className="space-button" href={project.href} target="_blank" rel="noopener noreferrer">
              {isApp ? "Open the running app ↗" : "Open the site ↗"}
            </a>
          )}
          <button className="space-button quiet" type="button" onClick={() => setView("list")}>
            The list
          </button>
          <button className="space-button quiet" type="button" onClick={onClose}>
            Back
          </button>
        </div>
      </header>

      <div className="space3d-stage" ref={mount}>
        <div className="space3d-zoom">
          <button type="button" aria-label="Fly in" onClick={() => zoom.current(0.78)}>
            +
          </button>
          <button type="button" aria-label="Fly out" onClick={() => zoom.current(1.28)}>
            −
          </button>
        </div>
      </div>

      <p className="space3d-legend">
        {isApp
          ? "Drag to turn, wheel to fly in · every star is a part of the app · every sheet is that part's own name, lit"
          : "Drag to turn, wheel to fly in · a star is a page · a panel is that page itself, fetched and made safe, not a drawing of it · a stream is a link read off the page"}
      </p>

      {selectedNode ? (
        <aside className="space3d-card">
          <p className="space-kicker">{selectedNode.kind === "hub" ? "You are standing next to this one" : "This page"}</p>
          <h3>{selectedNode.label}</h3>
          {selectedNode.href ? (
            <p className="space3d-address">{selectedNode.href.replace(/^https?:\/\//, "")}</p>
          ) : null}
          <p className="space3d-state">{stateOf(selectedNode.id)}</p>
          <div className="space-head-actions">
            {selectedNode.href ? (
              <a className="space-button" href={selectedNode.href} target="_blank" rel="noopener noreferrer">
                Open the page ↗
              </a>
            ) : null}
            {selectedNode.href ? (
              <button
                className="space-button quiet"
                type="button"
                onClick={() => show.current(selectedNode.id)}
              >
                Show it live
              </button>
            ) : null}
            {selectedNode.href ? (
              <button
                className="space-button quiet"
                type="button"
                onClick={() => void readOne(selectedNode.href, selectedNode.id)}
                disabled={readings[selectedNode.id] === "reading"}
              >
                Read its links
              </button>
            ) : null}
            <button className="space-button quiet" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </aside>
      ) : null}

    </div>
  );
}
