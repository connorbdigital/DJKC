/**
 * The Atlas renderer.
 *
 * Plain three.js, no react-three-fiber: the scene is built once from the atlas
 * data, the frame loop owns the camera, and React only hears about selections
 * and district changes. That keeps a 60fps space from re-rendering a component
 * tree sixty times a second.
 *
 * Two layers: WebGL for the space itself, CSS3D for the live site panels. The
 * CSS3D layer paints over the canvas, and Chromium does not hit-test a
 * `pointer-events: none` root, so input is bound to the stage that holds both
 * layers instead — panels keep their own clicks, everything else flies.
 */
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import type { Atlas, AtlasNode, District, NodeKind } from "./atlas";
import { compass, kindColour, nearestDistrict, nearestNode } from "./atlas";

export interface EngineHandlers {
  onSelect: (node: AtlasNode | null) => void;
  onTick: (info: { position: [number, number, number]; district: District; heading: string; near: string | null }) => void;
  onStatus: (message: string) => void;
}

interface Pickable {
  node: AtlasNode;
  mesh: THREE.Object3D;
  /** The thing whose opacity changes on selection: a mesh material or a card sprite. */
  material: THREE.Material & { opacity: number };
  halo?: THREE.Mesh;
}

const FOV = 62;
const SPEED = 26;
const BOOST = 3.2;
const EYE_HEIGHT = 1.7;

function labelSprite(text: string, options: { size?: number; colour?: string; weight?: number; max?: number } = {}) {
  const size = options.size ?? 30;
  const colour = options.colour ?? "#f5effa";
  const weight = options.weight ?? 600;
  const maxWidth = options.max ?? 46;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxWidth && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);

  const canvas = document.createElement("canvas");
  const width = 512;
  const lineHeight = size * 1.35;
  const height = Math.ceil(lines.length * lineHeight + size);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `${weight} ${size}px Manrope, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(10,5,18,0.55)";
    context.fillRect(0, 0, width, height);
    context.fillStyle = colour;
    lines.forEach((entry, index) => {
      context.fillText(entry, width / 2, size * 0.9 + index * lineHeight);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  const scale = options.weight === 700 ? 0.014 : 0.0095;
  sprite.scale.set(width * scale, height * scale, 1);
  return sprite;
}

/** A blog brief drawn as a card: title, service, length — readable from across the room. */
function cardSprite(node: AtlasNode) {
  const width = 640;
  const height = 360;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    const accent = kindColour[node.kind];
    context.fillStyle = "#0d1424";
    context.fillRect(0, 0, width, height);
    context.fillStyle = accent;
    context.fillRect(0, 0, 12, height);
    context.strokeStyle = "#ffffff2e";
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, width - 3, height - 3);

    context.fillStyle = accent;
    context.font = "600 20px 'IBM Plex Mono', monospace";
    context.fillText(`${node.kind.toUpperCase()} · ${(node.bullets[0] ?? "").toUpperCase()}`, 40, 56);

    context.fillStyle = "#ffffff";
    context.font = "700 38px Manrope, system-ui, sans-serif";
    const words = node.label.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > 26 && line) {
        lines.push(line.trim());
        line = word;
      } else line = `${line} ${word}`.trim();
    }
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((entry, index) => context.fillText(entry, 40, 122 + index * 44));

    context.fillStyle = "#9fb3c8";
    context.font = "500 21px Manrope, system-ui, sans-serif";
    const sub = node.line.split(" ").slice(0, 11).join(" ");
    context.fillText(sub, 40, height - 52);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(5, 2.8, 1);
  return sprite;
}

export class AtlasEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cssRenderer: CSS3DRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1600);
  private readonly rig = new THREE.Object3D();
  private readonly pickables: Pickable[] = [];
  private readonly labels: { sprite: THREE.Sprite; kind: NodeKind; base: THREE.Vector3 }[] = [];
  private readonly cards: { sprite: THREE.Sprite; base: THREE.Vector3 }[] = [];
  private readonly panels = new Map<string, HTMLElement>();
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly handlers: EngineHandlers;
  private readonly atlas: Atlas;
  private readonly edgeLines: { from: string; to: string; kind: string; line: THREE.LineSegments }[] = [];
  private frame = 0;
  private yaw = 0;
  private pitch = -0.13;
  private dragging = false;
  private dragDistance = 0;
  private last = { x: 0, y: 0 };
  private flight: { from: THREE.Vector3; to: THREE.Vector3; look: THREE.Vector3; t: number } | null = null;
  private selected: string | null = null;
  private disposed = false;
  private xrControllers: THREE.Group[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly cssHost: HTMLElement,
    private readonly stage: HTMLElement,
    atlas: Atlas,
    handlers: EngineHandlers
  ) {
    this.atlas = atlas;
    this.handlers = handlers;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    this.renderer.setClearColor(0x0a0512, 1);
    this.renderer.xr.enabled = true;
    host.appendChild(this.renderer.domElement);

    this.cssRenderer = new CSS3DRenderer();
    this.cssRenderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    this.cssRenderer.domElement.className = "atlas-css";
    cssHost.appendChild(this.cssRenderer.domElement);

    this.scene.fog = new THREE.Fog(0x0a0512, 60, 420);
    /* A dusting of far points so the space reads as depth, not a black wall. */
    const dust = new Float32Array(1400 * 3);
    for (let index = 0; index < 1400; index += 1) {
      dust[index * 3] = (Math.random() - 0.5) * 900;
      dust[index * 3 + 1] = Math.random() * 340 - 40;
      dust[index * 3 + 2] = (Math.random() - 0.5) * 900;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dust, 3));
    this.scene.add(
      new THREE.Points(
        dustGeometry,
        new THREE.PointsMaterial({ color: 0x9f8cff, size: 0.9, transparent: true, opacity: 0.5, sizeAttenuation: true, fog: false })
      )
    );
    this.scene.add(this.rig);
    this.rig.add(this.camera);
    this.camera.rotation.order = "YXZ";
    this.rig.position.set(0, 30, 132);
    cameraLook(this.rig, this.camera, this.yaw, this.pitch);

    this.scene.add(new THREE.AmbientLight(0xb9a5ff, 0.9));
    const key = new THREE.PointLight(0xff2bd6, 320, 260, 2);
    key.position.set(0, 40, 0);
    this.scene.add(key);
    const cool = new THREE.PointLight(0x7dd3fc, 220, 320, 2);
    cool.position.set(0, 18, 150);
    this.scene.add(cool);

    this.buildStars();
    const grid = new THREE.GridHelper(420, 42, 0x8c5bff, 0x2a1740);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.16;
    grid.position.y = 0;
    this.scene.add(grid);
    this.buildDistrictLabels();
    this.buildEdges();
    this.buildNodes();
    this.buildGalleryPanels();
    this.bindEvents();
    this.start();
  }

  /* ------------------------------------------------------------- the scene */

  private buildStars() {
    const count = 2400;
    const positions = new Float32Array(count * 3);
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const radius = 300 + random() * 480;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.7;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xcbb6ff, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7 });
    this.scene.add(new THREE.Points(geometry, material));
  }

  private buildDistrictLabels() {
    for (const district of this.atlas.districts) {
      const sprite = labelSprite(district.label, { size: 34, colour: "#c9b8ff", weight: 700, max: 22 });
      sprite.position.set(district.centre[0], district.centre[1] + 13, district.centre[2]);
      this.scene.add(sprite);
    }
  }

  private buildEdges() {
    const byId = new Map(this.atlas.nodes.map((node) => [node.id, node]));
    const colours: Record<string, number> = { installs: 0xffd166, proves: 0x7dd3fc, contains: 0x6ee7b7 };
    const opacity: Record<string, number> = { installs: 0.26, proves: 0.12, contains: 0.16 };
    for (const edge of this.atlas.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) continue;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...from.position),
        new THREE.Vector3(
          (from.position[0] + to.position[0]) / 2,
          Math.max(from.position[1], to.position[1]) + 7,
          (from.position[2] + to.position[2]) / 2
        ),
        new THREE.Vector3(...to.position)
      );
      const points = curve.getPoints(28);
      const vertices = points.flatMap((point, index) => (index === 0 ? [] : [...points[index - 1]!, point.x, point.y, point.z]));
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      const line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: colours[edge.kind] ?? 0xffffff, transparent: true, opacity: opacity[edge.kind] ?? 0.2 })
      );
      /* The brief → process links are the busiest thing here, so they only appear
         once a post is selected: the space stays readable until you ask. */
      line.visible = edge.kind !== "proves";
      this.edgeLines.push({ from: edge.from, to: edge.to, kind: edge.kind, line });
      this.scene.add(line);
    }
  }

  /** Edges follow their endpoints: hide a district and its wiring goes with it. */
  private updateEdges() {
    const shown = new Set(this.pickables.filter((entry) => entry.mesh.visible).map((entry) => entry.node.id));
    const selectedIsBrief = this.atlas.nodes.find((node) => node.id === this.selected)?.kind === "brief";
    for (const edge of this.edgeLines) {
      edge.line.visible =
        (edge.kind !== "proves" || selectedIsBrief) && shown.has(edge.from) && shown.has(edge.to);
    }
  }

  private buildNodes() {
    for (const node of this.atlas.nodes) {
      const colour = new THREE.Color(kindColour[node.kind]);
      const group = new THREE.Group();
      group.position.set(...node.position);

      if (node.kind === "brief") {
        const card = cardSprite(node);
        this.cards.push({ sprite: card, base: card.scale.clone() });
        card.renderOrder = 2;
        const pick = new THREE.Mesh(
          new THREE.PlaneGeometry(node.size * 2.6, node.size * 1.6),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        group.add(card, pick);
        this.scene.add(group);
        this.pickables.push({ node, mesh: group, material: card.material });
        continue;
      }

      const geometry = node.kind === "site" ? new THREE.BoxGeometry(node.size * 1.7, node.size * 1.1, 0.14) : new THREE.IcosahedronGeometry(node.size, node.kind === "project" ? 2 : 1);
      const material = new THREE.MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: node.kind === "project" ? 1.1 : 0.8,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(node.size * 1.34, node.size * 0.03, 8, 44),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.0 })
      );
      halo.rotation.x = Math.PI / 2;
      group.add(halo);

      const showLabel = node.kind === "project" || node.kind === "capability" || node.kind === "pack";
      if (showLabel) {
        const sprite = labelSprite(node.label, { size: 26, max: 40 });
        sprite.position.y = node.size + 2.2;
        group.add(sprite);
        this.labels.push({ sprite, kind: node.kind, base: sprite.scale.clone() });
      }

      this.scene.add(group);
      this.pickables.push({ node, mesh, material, halo });
    }
  }

  private buildGalleryPanels() {
    const sites = this.atlas.nodes.filter((node) => node.kind === "site");
    for (const node of sites) {
      const element = document.createElement("div");
      element.className = "atlas-panel";
      element.style.width = "900px";
      element.style.height = "620px";
      element.innerHTML = `
        <div class="atlas-panel-head">
          <span class="dot"></span>
          <strong>${escapeHtml(node.label)}</strong>
          <span class="atlas-panel-url">${escapeHtml(node.href ?? "")}</span>
        </div>
        <div class="atlas-panel-body">
          <div class="atlas-panel-card">
            <p class="eyebrow">${escapeHtml(String(node.bullets[1] ?? "Reference site"))}</p>
            <h3>${escapeHtml(node.label)}</h3>
            <p>${escapeHtml(String(node.bullets[0] ?? ""))}</p>
            <p class="atlas-panel-note">Select it and choose “Load the live page”. Most big sites refuse to be framed by another domain; when that happens the frame stays blank and the tab link is the way in.</p>
          </div>
        </div>`;
      this.panels.set(node.id, element);
      const object = new CSS3DObject(element);
      /* CSS3D panels are one-sided in practice: seen from behind, the text
         mirrors. The space is entered from -Z, so each panel turns its face
         that way (π), fanning outwards slightly at the edges of the row. */
      const curve = Math.PI + clamp(node.position[0] / 260, -0.22, 0.22);
      object.position.set(node.position[0], node.position[1], node.position[2] - 8);
      object.rotation.set(0, curve, 0);
      object.scale.setScalar(0.012);
      element.style.pointerEvents = "none";
      this.scene.add(object);
    }
  }

  /* --------------------------------------------------------------- input */

  private bindEvents() {
    this.stage.addEventListener("pointerdown", this.onPointerDown);
    this.stage.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    this.stage.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private onPointerDown = (event: PointerEvent) => {
    /* A click inside a live page belongs to the page, not to the camera. */
    if ((event.target as HTMLElement).closest?.(".atlas-panel")) return;
    this.dragging = true;
    this.dragDistance = 0;
    this.last = { x: event.clientX, y: event.clientY };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    const dx = event.clientX - this.last.x;
    const dy = event.clientY - this.last.y;
    this.last = { x: event.clientX, y: event.clientY };
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    this.yaw -= dx * 0.0026;
    this.pitch = clamp(this.pitch - dy * 0.0022, -1.32, 1.32);
    cameraLook(this.rig, this.camera, this.yaw, this.pitch);
  };

  private onPointerUp = (event: PointerEvent) => {
    const wasDragging = this.dragging;
    this.dragging = false;
    if (!wasDragging || this.dragDistance > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visible = this.pickables.filter((entry) => entry.mesh.visible);
    const hits = this.raycaster.intersectObjects(visible.map((entry) => entry.mesh), true);
    const hit = hits[0];
    if (!hit) {
      this.select(null);
      return;
    }
    const owner = visible.find((entry) => {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (object === entry.mesh) return true;
        object = object.parent;
      }
      return false;
    });
    if (owner) this.select(owner.node.id);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && /input|textarea|select/i.test(target.tagName)) return;
    this.keys.add(event.key.toLowerCase());
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(event.key.toLowerCase())) event.preventDefault();
    if (event.key === "f" && this.selected) this.flyToId(this.selected);
    if (event.key === "Escape") this.select(null);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };

  private onWheel = (event: WheelEvent) => {
    if ((event.target as HTMLElement).closest?.(".atlas-panel")) return;
    event.preventDefault();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.quaternion);
    const step = clamp(event.deltaY, -240, 240) * -0.06;
    this.flight = null;
    this.rig.position.addScaledVector(forward, step);
  };

  /* ------------------------------------------------------------ behaviour */

  select(id: string | null) {
    this.selected = id;
    const node = id ? this.atlas.nodes.find((entry) => entry.id === id) ?? null : null;
    this.updateEdges();
    for (const entry of this.pickables) {
      entry.material.opacity = !node || entry.node.id === node.id ? 1 : 0.5;
      if (entry.halo && entry.halo.material instanceof THREE.MeshBasicMaterial) {
        entry.halo.material.opacity = entry.node.id === node?.id ? 0.6 : 0;
      }
    }
    this.handlers.onSelect(node);
  }

  /** Put a live page inside its gallery panel. The click has to come from real
   * DOM outside the 3D layer: Chromium does not hit-test CSS3D content. */
  loadSite(id: string): boolean {
    const panel = this.panels.get(id);
    const node = this.atlas.nodes.find((entry) => entry.id === id);
    if (!panel || !node?.href) return false;
    const body = panel.querySelector(".atlas-panel-body");
    if (!body) return false;
    body.innerHTML = `<iframe src="${escapeHtml(node.href)}" title="${escapeHtml(
      node.label
    )}" loading="lazy" referrerpolicy="no-referrer"></iframe><p class="atlas-panel-note" style="position:absolute;bottom:0;left:0;right:0;background:#0a0512cc;margin:0;padding:.5rem .75rem">If this is empty, the site sends <code>X-Frame-Options</code> — use the tab link. Nothing is proxied or scraped.</p>`;
    this.handlers.onStatus(`${node.label}: live page requested. If the frame stays blank, the site refuses to be framed.`);
    return true;
  }

  flyToId(id: string) {
    const node = this.atlas.nodes.find((entry) => entry.id === id);
    if (!node) return;
    this.flyTo(node);
  }

  flyTo(node: AtlasNode) {
    const target = new THREE.Vector3(...node.position);
    const direction = new THREE.Vector3().subVectors(this.rig.position, target).normalize();
    if (direction.lengthSq() < 0.01) direction.set(0, 0.2, 1).normalize();
    const stop =
      node.kind === "site"
        ? new THREE.Vector3(target.x, target.y, target.z - 20)
        : target.clone().addScaledVector(direction, node.kind === "brief" ? 12 : 17);
    stop.y = node.kind === "site" ? target.y : Math.max(6, target.y + 4);
    this.flight = { from: this.rig.position.clone(), to: stop, look: target, t: 0 };
    this.select(node.id);
  }

  focusDistrict(centre: [number, number, number], distance = 46) {
    const target = new THREE.Vector3(...centre);
    const stop = target.clone().add(new THREE.Vector3(0, 8, distance));
    this.flight = { from: this.rig.position.clone(), to: stop, look: target, t: 0 };
  }

  setFilter(kind: NodeKind | "all") {
    for (const entry of this.pickables) {
      const visible = kind === "all" || entry.node.kind === kind;
      entry.mesh.visible = visible;
    }
    for (const label of this.labels) {
      label.sprite.visible = kind === "all" || label.kind === kind;
    }
    for (const card of this.cards) card.sprite.visible = kind === "all" || kind === "brief";
    this.updateEdges();
  }

  async enterVR(): Promise<boolean> {
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!xr) return false;
    const supported = await xr.isSessionSupported("immersive-vr");
    if (!supported) return false;
    const session = await xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
    await this.renderer.xr.setSession(session);
    this.cssHost.style.display = "none";
    this.host.classList.add("is-vr");
    session.addEventListener("end", () => {
      this.cssHost.style.display = "";
      this.host.classList.remove("is-vr");
    });
    if (!this.xrControllers.length) this.buildControllers();
    return true;
  }

  private buildControllers() {
    for (let index = 0; index < 2; index++) {
      const controller = this.renderer.xr.getController(index);
      controller.addEventListener("selectstart", () => {
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
        this.rig.position.addScaledVector(direction, 9);
        this.handlers.onStatus("Moved 9 units along the controller ray");
      });
      this.rig.add(controller);
      this.scene.add(controller);
      this.xrControllers.push(controller);
    }
    const grip = this.renderer.xr.getControllerGrip(0);
    grip.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff2bd6 })));
    this.scene.add(grip);
  }

  resize = () => {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.cssRenderer.setSize(width, height);
  };

  private start() {
    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      this.step();
      this.renderer.render(this.scene, this.camera);
      this.cssRenderer.render(this.scene, this.camera);
    });
  }

  private step() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.frame++;

    if (this.flight) {
      this.flight.t = Math.min(1, this.flight.t + delta / 1.15);
      const eased = easeInOut(this.flight.t);
      this.rig.position.lerpVectors(this.flight.from, this.flight.to, eased);
      const direction = new THREE.Vector3().subVectors(this.flight.look, this.rig.position).normalize();
      const wanted = Math.atan2(-direction.x, -direction.z);
      this.yaw = lerpAngle(this.yaw, wanted, Math.min(1, delta * 6));
      const pitch = Math.asin(clamp(direction.y, -1, 1));
      this.pitch = this.pitch + (pitch - this.pitch) * Math.min(1, delta * 6);
      cameraLook(this.rig, this.camera, this.yaw, this.pitch);
      if (this.flight.t >= 1) this.flight = null;
    } else {
      this.applyKeys(delta);
    }

    /* Gentle drift so the space never looks like a still image. */
    for (const entry of this.pickables) {
      entry.mesh.rotation.y += delta * (entry.node.kind === "project" ? 0.12 : 0.05);
      const pulse = 1 + Math.sin(this.frame * 0.02 + entry.mesh.position.x) * 0.03;
      entry.mesh.scale.setScalar(entry.node.id === this.selected ? 1.18 : pulse);
    }

    /* Labels keep a readable size on screen instead of shrinking into pixels. */
    for (const label of this.labels) {
      const world = label.sprite.getWorldPosition(new THREE.Vector3());
      const away = world.distanceTo(this.rig.position);
      const factor = clamp(away / 34, 0.55, 2.4);
      label.sprite.scale.set(label.base.x * factor, label.base.y * factor, 1);
      /* Thirteen process names inside one sphere become a wall of text from
         across the room; they appear when you are close enough to read them. */
      if (label.kind === "capability" || label.kind === "step") label.sprite.visible = away < 62;
    }
    for (const card of this.cards) {
      const world = card.sprite.getWorldPosition(new THREE.Vector3());
      const away = world.distanceTo(this.rig.position);
      const factor = clamp(away / 42, 0.55, 1.9);
      card.sprite.scale.set(card.base.x * factor, card.base.y * factor, 1);
    }

    if (this.frame % 12 === 0) {
      const position = this.rig.position;
      const district = nearestDistrict(this.atlas, [position.x, position.y, position.z]);
      const near = nearestNode(this.atlas, [position.x, position.y, position.z]);
      this.handlers.onTick({
        position: [Math.round(position.x), Math.round(position.y), Math.round(position.z)],
        district,
        heading: compass(this.yaw),
        near: near && near.distance < 14 ? near.node.label : null,
      });
    }
  }

  private applyKeys(delta: number) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const direction = new THREE.Vector3();
    if (this.keys.has("w") || this.keys.has("arrowup")) direction.add(forward);
    if (this.keys.has("s") || this.keys.has("arrowdown")) direction.sub(forward);
    if (this.keys.has("d") || this.keys.has("arrowright")) direction.add(right);
    if (this.keys.has("a") || this.keys.has("arrowleft")) direction.sub(right);
    if (this.keys.has("e") || this.keys.has(" ")) direction.y += 1;
    if (this.keys.has("q")) direction.y -= 1;

    if (direction.lengthSq() > 0) direction.normalize();
    const boost = this.keys.has("shift") ? BOOST : 1;
    this.velocity.lerp(direction.multiplyScalar(SPEED * boost), Math.min(1, delta * 9));
    this.rig.position.addScaledVector(this.velocity, delta);

    /* Turn with the keyboard too: a space you can only explore with a mouse is half a space. */
    const turn = (this.keys.has("z") ? 1 : 0) - (this.keys.has("c") ? 1 : 0);
    if (turn) {
      this.yaw += turn * delta * 1.6;
      cameraLook(this.rig, this.camera, this.yaw, this.pitch);
    }
    const floor = EYE_HEIGHT;
    if (this.rig.position.y < floor) this.rig.position.y = floor;
    if (this.rig.position.y > 160) this.rig.position.y = 160;
    const radius = Math.hypot(this.rig.position.x, this.rig.position.z);
    if (radius > 300) {
      this.rig.position.x *= 300 / radius;
      this.rig.position.z *= 300 / radius;
      this.handlers.onStatus("That is the edge of the atlas — the space is bounded so you cannot get lost.");
    }
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
    this.host.innerHTML = "";
    this.cssHost.innerHTML = "";
  }
}

function cameraLook(rig: THREE.Object3D, camera: THREE.Camera, yaw: number, pitch: number) {
  rig.rotation.set(0, yaw, 0);
  camera.rotation.set(pitch, 0, 0, "YXZ");
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function lerpAngle(from: number, to: number, t: number) {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
