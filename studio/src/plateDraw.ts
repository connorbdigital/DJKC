import * as THREE from "three";
import type { PlateLayout } from "./plate";

/**
 * A plate layout, drawn on a canvas, wrapped as a texture.
 *
 * This is the only file that knows both about the layout and about three.js.
 * Everything it draws comes from `plate.ts`; the one thing it adds is the page's
 * own picture, which has to be fetched as same-origin bytes (see `api/site.ts`)
 * or the canvas is tainted and WebGL refuses the upload.
 *
 * Failure is quiet on purpose: a page whose picture will not load still gets a
 * plate with its colours and its words, and a plate that cannot be drawn at all
 * returns null so the caller keeps the star it already had.
 */

const FONTS = {
  body: '600 0px Manrope, system-ui, -apple-system, "Segoe UI", sans-serif',
  regular: '400 0px Manrope, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '400 0px "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
};

function fontFor(size: number, weight?: number, mono?: boolean): string {
  const family = mono
    ? '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace'
    : 'Manrope, system-ui, -apple-system, "Segoe UI", sans-serif';
  return `${weight ?? (mono ? 400 : 400)} ${size}px ${family}`;
}

/** Load one image with a deadline. A picture that is slow is a picture that is absent. */
function loadImage(src: string, timeout = 6_000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let done = false;
    const finish = (value: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeout);
    image.onload = () => {
      clearTimeout(timer);
      finish(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    image.decoding = "async";
    image.src = src;
  });
}

/** Cover, not contain: a plate is a window, and letterboxing a window looks broken. */
function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: { x: number; y: number; w: number; h: number }) {
  const ratio = Math.max(box.w / image.width, box.h / image.height);
  const w = image.width * ratio;
  const h = image.height * ratio;
  ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
}

/**
 * The plate as a canvas. One drawing routine feeds both worlds: the City takes
 * it as a texture, and the Atlas puts it in a panel as an image, where it stays
 * crisp however far you fly in.
 */
export async function plateCanvas(
  layout: PlateLayout,
  image: string | null,
  options: { scale?: number } = {}
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  const scale = options.scale ?? 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  /* Wait for the page's fonts, but never longer than a moment: a plate in the
     fallback face reads fine, a space that waits on a font reads broken. */
  await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((resolve) => setTimeout(resolve, 1_500))]);

  ctx.scale(scale, scale);
  ctx.textBaseline = "top";
  for (const op of layout.ops) {
    if (op.kind === "fill") {
      ctx.globalAlpha = op.alpha ?? 1;
      ctx.fillStyle = op.colour;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.font = fontFor(op.size, op.weight, op.mono);
    ctx.fillStyle = op.colour;
    ctx.fillText(op.text, op.x, op.y);
  }

  if (image && layout.imageSlot) {
    const loaded = await loadImage(image);
    if (loaded) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(layout.imageSlot.x, layout.imageSlot.y, layout.imageSlot.w, layout.imageSlot.h);
      ctx.clip();
      drawCover(ctx, loaded, layout.imageSlot);
      ctx.restore();
    }
  }

  return canvas;
}

/** The same drawing, wrapped for a material: the City hangs its plinths' pages this way. */
export async function plateTexture(
  layout: PlateLayout,
  image: string | null,
  options: { scale?: number; anisotropy?: number } = {}
): Promise<THREE.CanvasTexture | null> {
  const canvas = await plateCanvas(layout, image, options);
  if (!canvas) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = options.anisotropy ?? 4;
  texture.needsUpdate = true;
  return texture;
}

/** Font strings, exported so a caller that measures text uses the same faces. */
export const PLATE_FONTS = FONTS;
