import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildAtlas, kindColour, type AtlasNode } from "../atlas";
import { loadAnythingApps, type AnythingApp } from "../anythingClient";
import { scannedApps } from "../anythingScan";
import { CORRIDOR, DOOR, ROOM_HIDDEN_LABEL, doorSign, forwardOf, planCity, roomAt, step, yawFor, type CityRoom } from "../city";
import ProjectSpace from "./ProjectSpace";

/**
 * The City: the Studio as a building you walk through.
 *
 * Eight rooms off one corridor, each holding a district of the Atlas. The plan
 * comes from `city.ts` — floors, walls with doorways, a plinth per node — and
 * this file only draws it and moves the camera. Drag to look, WASD to walk, tap
 * a room in the directory to stand at its door, click a plinth to read the thing
 * standing on it.
 */

interface CityProps {
  onLeave: () => void;
  onAtlas?: () => void;
}

const HEIGHT = 1.62;
const SPEED = 3.6;
const WALK_RADIUS = 0.42;

/** Text on a plane, drawn once into a canvas: no fonts to load, no layout to wait for. */
function labelTexture(text: string, colour = "#ffffff", background = "rgba(10,5,18,0.78)") {
  const width = 512;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    const shown = text.length > 24 ? `${text.slice(0, 23)}…` : text;
    /* Shrink to fit: a label clipped by its own canvas reads as a broken word,
       and a room full of broken words is worse than no labels. */
    let size = 52;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    do {
      ctx.font = `600 ${size}px Manrope, system-ui, sans-serif`;
      size -= 2;
    } while (ctx.measureText(shown).width > width - 32 && size > 18);
    ctx.fillStyle = colour;
    ctx.fillText(shown, width / 2, height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export default function City({ onLeave, onAtlas }: CityProps) {
  /* The room is furnished from the build-time scan, then refreshed if the live
     read succeeds. An Anything room that depends on a request is a room that is
     empty whenever the API is having a day. */
  const [apps, setApps] = useState<AnythingApp[]>(() => scannedApps);
  const [selected, setSelected] = useState<AtlasNode | null>(null);
  const [space, setSpace] = useState<AtlasNode | null>(null);
  const [here, setHere] = useState<string>("The corridor");
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const atlas = useMemo(() => buildAtlas([], apps), [apps]);
  const plan = useMemo(() => planCity(atlas), [atlas]);

  const mount = useRef<HTMLDivElement>(null);
  const walk = useRef({ forward: 0, strafe: 0 });
  const pose = useRef({ x: plan.entrance.x, z: plan.entrance.z, yaw: plan.entrance.heading, pitch: 0 });
  const teleport = useRef<((room: CityRoom) => void) | null>(null);
  const inspector = useRef<((node: AtlasNode | null) => void) | null>(null);

  /* Anything's apps arrive after the building is standing: a room that is empty
     because the bridge has not answered says so, rather than looking abandoned. */
  useEffect(() => {
    let cancelled = false;
    void loadAnythingApps({ limit: 24 }).then((result) => {
      if (cancelled) return;
      if (result.ok) setApps(result.apps);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const goTo = useCallback((room: CityRoom) => {
    teleport.current?.(room);
    setSelected(null);
  }, []);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed("This browser will not draw the building. The Atlas still works, and every room is listed below.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07040f);
    scene.fog = new THREE.Fog(0x07040f, 26, 80);

    /* A tall phone gets a wider vertical field, or the corridor is a keyhole:
       72° across is the target, and portrait has to open up to reach it. */
    const fieldOfView = (width: number, height: number) => (width >= height ? 72 : 86);
    const camera = new THREE.PerspectiveCamera(
      fieldOfView(host.clientWidth, host.clientHeight),
      host.clientWidth / host.clientHeight,
      0.05,
      200
    );
    camera.position.set(pose.current.x, HEIGHT, pose.current.z);

    scene.add(new THREE.HemisphereLight(0xcfc2ff, 0x1a1428, 1.6));
    const key = new THREE.DirectionalLight(0xffe4f8, 2.1);
    key.position.set(-16, 26, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -46;
    key.shadow.camera.right = 46;
    key.shadow.camera.top = 40;
    key.shadow.camera.bottom = -40;
    scene.add(key);

    /* ── floors ──────────────────────────────────────────────────────── */
    const corridorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR.to - CORRIDOR.from, CORRIDOR.half * 2),
      new THREE.MeshStandardMaterial({ color: 0x231a35, roughness: 0.85, metalness: 0.05 })
    );
    corridorFloor.rotation.x = -Math.PI / 2;
    corridorFloor.position.set((CORRIDOR.from + CORRIDOR.to) / 2, 0, 0);
    corridorFloor.receiveShadow = true;
    scene.add(corridorFloor);

    /* The corridor's spine: a strip of light down the middle, so walking has a direction. */
    const spine = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR.to - CORRIDOR.from - 2, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.32 })
    );
    spine.rotation.x = -Math.PI / 2;
    spine.position.set((CORRIDOR.from + CORRIDOR.to) / 2, 0.012, 0);
    scene.add(spine);

    for (const room of plan.rooms) {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.w, room.d),
        new THREE.MeshStandardMaterial({ color: 0x2a2040, roughness: 0.8, metalness: 0.06 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(room.x, 0.001, room.z);
      floor.receiveShadow = true;
      scene.add(floor);

      /* A band of the room's own colour at the threshold: from the corridor you
         can tell which room you are about to walk into. */
      const band = new THREE.Mesh(
        new THREE.PlaneGeometry(DOOR.width - 0.4, 1.4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(room.colour), transparent: true, opacity: 0.5 })
      );
      band.rotation.x = -Math.PI / 2;
      band.position.set(room.door.x, 0.014, room.door.z + (room.side === "left" ? -0.8 : 0.8));
      scene.add(band);
    }

    /* ── walls ───────────────────────────────────────────────────────── */
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x40355f, roughness: 0.92, metalness: 0.04 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x6d5b96, roughness: 0.7, metalness: 0.1 });
    for (const wall of plan.walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wall.h, wall.d), wallMaterial);
      mesh.position.set(wall.x, wall.h / 2, wall.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      /* A trim at hand height gives the wall a scale you can read in the dark. */
      const trim = new THREE.Mesh(new THREE.BoxGeometry(Math.max(wall.w, 0.34) + 0.02, 0.06, Math.max(wall.d, 0.34) + 0.02), trimMaterial);
      trim.position.set(wall.x, 1.05, wall.z);
      scene.add(trim);
    }

    /* ── doorways: frames and signs ──────────────────────────────────── */
    const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
    for (const room of plan.rooms) {
      const frameMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(room.colour), roughness: 0.4, metalness: 0.3 });
      const post = new THREE.BoxGeometry(0.16, DOOR.height, 0.5);
      for (const offset of [-1, 1]) {
        const mesh = new THREE.Mesh(post, frameMaterial);
        mesh.position.set(room.door.x + (offset * (DOOR.width / 2 - 0.08)), DOOR.height / 2, room.door.z);
        scene.add(mesh);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR.width + 0.16, 0.16, 0.5), frameMaterial);
      lintel.position.set(room.door.x, DOOR.height, room.door.z);
      scene.add(lintel);
      disposables.push(post, frameMaterial);

      /* The wall above the door. Without it the doorway is a hole to the sky
         and the sign floats in it. */
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR.width, CORRIDOR.height - DOOR.height, CORRIDOR.thickness),
        wallMaterial
      );
      header.position.set(room.door.x, DOOR.height + (CORRIDOR.height - DOOR.height) / 2, room.door.z);
      header.castShadow = true;
      scene.add(header);

      /* An illuminated plate: light face, dark letters, readable down the corridor. */
      const texture = labelTexture(doorSign(room), "#120a1c", "#e9e0fa");
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.7, 0.62),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true })
      );
      sign.position.set(room.door.x, DOOR.height + (CORRIDOR.height - DOOR.height) / 2, room.door.z + (room.side === "left" ? 0.17 : -0.17));
      sign.rotation.y = room.side === "left" ? 0 : Math.PI;
      scene.add(sign);
      disposables.push(texture, sign.geometry, sign.material as THREE.Material);

      /* A pool of the room's own colour on its floor. Cheaper than a light and
         legible from the corridor: this is a place, not a light show. */
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(Math.min(room.w, room.d) * 0.42, 40),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(room.colour), transparent: true, opacity: 0.1 })
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(room.x, 0.02, room.z);
      scene.add(pool);
      disposables.push(pool.geometry, pool.material as THREE.Material);
    }

    /* ── ceilings: the box closes, and the corridor stops looking like a canyon ── */
    /* Unlit on purpose: a ceiling lit from above is a ceiling nothing shines on. */
    const ceilingMaterial = new THREE.MeshBasicMaterial({ color: 0x1d1531 });
    const corridorCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR.to - CORRIDOR.from, CORRIDOR.half * 2),
      ceilingMaterial
    );
    corridorCeiling.rotation.x = Math.PI / 2;
    corridorCeiling.position.set((CORRIDOR.from + CORRIDOR.to) / 2, CORRIDOR.height, 0);
    scene.add(corridorCeiling);
    for (const room of plan.rooms) {
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.d), ceilingMaterial);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.set(room.x, CORRIDOR.height, room.z);
      scene.add(ceiling);
    }

    /* ── strip lights over the corridor ──────────────────────────────── */
    const stripMaterial = new THREE.MeshBasicMaterial({ color: 0xf3e6ff, transparent: true, opacity: 0.72 });
    for (let x = CORRIDOR.from + 7; x < CORRIDOR.to; x += 7) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.22), stripMaterial);
      strip.position.set(x, CORRIDOR.height - 0.06, 0);
      scene.add(strip);
    }
    disposables.push(stripMaterial);

    /* ── one plinth and one orb per node ─────────────────────────────── */
    const pickable: THREE.Object3D[] = [];
    const plinthGeometry = new THREE.CylinderGeometry(0.34, 0.4, 0.9, 18);
    const orbGeometry = new THREE.SphereGeometry(0.26, 24, 18);
    for (const object of plan.objects) {
      const colour = new THREE.Color(kindColour[object.node.kind]);
      const plinth = new THREE.Mesh(
        plinthGeometry,
        new THREE.MeshStandardMaterial({ color: 0x241a36, roughness: 0.6, metalness: 0.2 })
      );
      plinth.position.set(object.x, 0.45, object.z);
      plinth.castShadow = true;
      scene.add(plinth);

      const orb = new THREE.Mesh(
        orbGeometry,
        new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 1.5, roughness: 0.25 })
      );
      orb.position.set(object.x, 1.18, object.z);
      orb.userData.node = object.node;
      scene.add(orb);
      pickable.push(orb);

      /* A sprite, not a plane: it always faces you, so a room full of labels
         stays readable from any angle and never shows its edge. */
      const texture = labelTexture(object.node.label, "#efe6ff", "rgba(8,4,16,0.72)");
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      sprite.scale.set(1.2, 0.3, 1);
      /* Alternating heights: neighbouring signs stop landing on top of each other. */
      sprite.position.set(object.x, 2.02 + (Math.round(object.z) % 2 === 0 ? 0 : 0.34), object.z);
      scene.add(sprite);
      disposables.push(texture, sprite.material as THREE.Material);
    }

    /* ── walking ─────────────────────────────────────────────────────── */
    teleport.current = (room: CityRoom) => {
      pose.current.x = room.x;
      /* Stand just inside the doorway, not in the middle of the room. */
      pose.current.z = room.door.z + (room.side === "left" ? -1.1 : 1.1);
      pose.current.yaw = room.side === "left" ? yawFor(0, -1) : yawFor(0, 1);
      pose.current.pitch = -0.06;
    };
    inspector.current = (node) => setSelected(node);

    const keys = new Set<string>();
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      keys.add(key);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key)) event.preventDefault();
      if (key === "escape") setSelected(null);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    let dragging = false;
    let lastX = 0;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      pose.current.yaw -= (event.clientX - lastX) * 0.0042;
      lastX = event.clientX;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      pose.current.pitch = Math.max(-0.6, Math.min(0.5, pose.current.pitch - event.deltaY * 0.0008));
    };
    host.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });

    /* Touch: the left third of the screen is a walk pad, the right is the look. */
    let padPointer: number | null = null;
    let padOrigin = { x: 0, y: 0 };
    const onTouchStart = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      if (event.clientX < window.innerWidth * 0.45 && padPointer === null) {
        padPointer = event.pointerId;
        padOrigin = { x: event.clientX, y: event.clientY };
      }
    };
    const onTouchMove = (event: PointerEvent) => {
      if (event.pointerId !== padPointer) return;
      const dx = (event.clientX - padOrigin.x) / 60;
      const dy = (event.clientY - padOrigin.y) / 60;
      walk.current.strafe = Math.max(-1, Math.min(1, dx));
      walk.current.forward = Math.max(-1, Math.min(1, -dy));
    };
    const onTouchEnd = (event: PointerEvent) => {
      if (event.pointerId !== padPointer) return;
      padPointer = null;
      walk.current.forward = 0;
      walk.current.strafe = 0;
    };
    host.addEventListener("pointerdown", onTouchStart);
    window.addEventListener("pointermove", onTouchMove);
    window.addEventListener("pointerup", onTouchEnd);

    /* Clicking a plinth: a tap that did not drag the camera. */
    const raycaster = new THREE.Raycaster();
    const centre = new THREE.Vector2(0, 0);
    const onClick = (event: PointerEvent) => {
      if (Math.abs(event.clientX - lastX) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      centre.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(centre, camera);
      const hit = raycaster.intersectObjects(pickable, false)[0];
      const node = hit?.object.userData.node as AtlasNode | undefined;
      if (node) {
        setSelected(node);
        setSpace(null);
      }
    };
    renderer.domElement.addEventListener("pointerup", onClick);

    const clock = new THREE.Clock();
    let frame = 0;
    let lastRoom = "";
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const delta = Math.min(clock.getDelta(), 0.06);

      const fast = keys.has("shift") ? 1.9 : 1;
      let forward = walk.current.forward;
      let strafe = walk.current.strafe;
      if (keys.has("w") || keys.has("arrowup")) forward += 1;
      if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
      if (keys.has("a") || keys.has("arrowleft")) strafe -= 1;
      if (keys.has("d") || keys.has("arrowright")) strafe += 1;
      if (keys.has("q")) pose.current.pitch = Math.min(0.5, pose.current.pitch + delta);
      if (keys.has("e")) pose.current.pitch = Math.max(-0.6, pose.current.pitch - delta);

      const length = Math.hypot(forward, strafe);
      if (length > 0.01) {
        const norm = Math.min(1, length);
        const ahead = forwardOf(pose.current.yaw);
        /* Right of the facing direction, for strafing. */
        const right = { x: -ahead.z, z: ahead.x };
        const dx = ((ahead.x * forward + right.x * strafe) / length) * norm * SPEED * fast * delta;
        const dz = ((ahead.z * forward + right.z * strafe) / length) * norm * SPEED * fast * delta;
        const next = step(pose.current.x, pose.current.z, dx, dz, plan.walls, WALK_RADIUS);
        pose.current.x = next.x;
        pose.current.z = next.z;
      }

      camera.position.set(pose.current.x, HEIGHT, pose.current.z);
      camera.rotation.set(pose.current.pitch, pose.current.yaw, 0, "YXZ");

      const room = roomAt(pose.current.x, pose.current.z, plan.rooms);
      const name = room ? room.label : "The corridor";
      if (name !== lastRoom) {
        lastRoom = name;
        setHere(name);
      }

      renderer.render(scene, camera);
    };
    loop();
    setReady(true);

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.fov = fieldOfView(host.clientWidth, host.clientHeight);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onTouchMove);
      window.removeEventListener("pointerup", onTouchEnd);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerdown", onTouchStart);
      host.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("pointerup", onClick);
      for (const item of disposables) item.dispose();
      plinthGeometry.dispose();
      orbGeometry.dispose();
      wallMaterial.dispose();
      trimMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [plan]);

  const selectedRoom = selected ? plan.rooms.find((entry) => entry.districts.includes(selected.district)) : undefined;
  const hidden = selectedRoom ? plan.hidden[selectedRoom.id] ?? 0 : 0;

  return (
    <div className="city">
      <div className="city-stage" ref={mount} data-testid="city-stage" />

      <header className="city-bar">
        <div className="city-title">
          <p className="eyebrow">The City</p>
          <strong>{here}</strong>
        </div>
        <nav className="city-directory" aria-label="Walk to a room">
          {plan.rooms.map((entry) => (
            <button key={entry.id} type="button" className="chip" onClick={() => goTo(entry)} title={entry.blurb}>
              <span className="city-dot" style={{ background: entry.colour }} />
              {doorSign(entry)}
              <span>{plan.objects.filter((object) => object.room === entry.id).length}</span>
            </button>
          ))}
        </nav>
        <div className="city-actions">
          {onAtlas ? (
            <button className="btn ghost" type="button" onClick={onAtlas} title="The Atlas: the same content as a solar system">
              Atlas (3D)
            </button>
          ) : (
            <a className="btn ghost" href="#tab=atlas" title="The Atlas: the same content as a solar system">
              Atlas (3D)
            </a>
          )}
          <button className="btn ghost" type="button" onClick={onLeave}>
            ← Studio
          </button>
        </div>
      </header>

      {!ready && !failed && <p className="city-loading">Opening the doors…</p>}
      {failed && <p className="city-failed">{failed}</p>}

      <p className="city-help">
        Drag to look · WASD or arrows to walk · <kbd>Shift</kbd> to hurry · click a plinth to read it ·{" "}
        <kbd>Esc</kbd> closes the card
      </p>

      {selected && (
        <aside className="city-card" aria-live="polite">
          <div className="city-card-head">
            <span className="city-dot" style={{ background: kindColour[selected.kind] }} />
            <h2>{selected.label}</h2>
            <button className="btn ghost" type="button" onClick={() => setSelected(null)} aria-label="Close the card">
              ×
            </button>
          </div>
          <p>{selected.line}</p>
          <p className="muted small">{selected.detail.slice(0, 320)}{selected.detail.length > 320 ? "…" : ""}</p>
          {selected.modules && selected.modules.length > 0 && (
            <div className="city-parts">
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
              {selected.bullets.slice(0, 5).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
          <div className="city-card-actions">
            {selected.href && (
              <a className="space-button" href={selected.href} target="_blank" rel="noopener noreferrer">
                Open ↗
              </a>
            )}
            {(selected.kind === "project" || selected.kind === "app") && (
              <button className="space-button" type="button" onClick={() => setSpace(selected)}>
                {selected.kind === "project" ? "Go inside ↗" : "What is inside ↗"}
              </button>
            )}
            {selectedRoom && (
              <button className="space-button quiet" type="button" onClick={() => goTo(selectedRoom)}>
                Walk to {doorSign(selectedRoom)}
              </button>
            )}
          </div>
          {hidden > 0 && (
            <p className="muted small">
              {ROOM_HIDDEN_LABEL(hidden)} — see the Atlas, or the Studio tab, for the rest.
            </p>
          )}
        </aside>
      )}

      {space && <ProjectSpace project={space} onClose={() => setSpace(null)} />}
    </div>
  );
}
