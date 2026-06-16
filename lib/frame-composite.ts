/**
 * Client-side: composite photo + Jonathon frame → PNG.
 *
 * Layer order (bottom → top):
 *   1. Original frame WITH starfield (background)
 *   2. Photo, clipped strictly inside the inner frame border rectangle
 *   3. Frame border overlay (starfield stripped) drawn on top — border always overlays the photo
 */

export type FrameInsets = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

/**
 * Inner safe area matching the actual blue border rectangle of the frame (ratios 0–1).
 * These keep the photo strictly inside the decorative border lines.
 * Bottom is larger to clear the Jonathon "J" logo.
 */
export const JONATHON_FRAME_INSETS: FrameInsets = {
  top: 0.088,
  left: 0.072,
  right: 0.072,
  bottom: 0.148,
};

export const FRAME_ASSET_PATH = "/frames/jonathon-frame.png";

export function loadImageElement(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    if (typeof src === "string") {
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/**
 * Strips EVERYTHING from the frame except the actual decorative elements:
 * - Blue border lines & filigree corners → kept opaque (Layer 3 overlay)
 * - Gold/copper Jonathon "J" logo        → kept opaque (Layer 3 overlay)
 * - Everything else (white fill, starfield dots, dark bg) → transparent
 *
 * This makes Layer 3 show ONLY the border on top, so the starfield from
 * Layer 1 is visible everywhere that the photo (Layer 2) doesn't cover.
 */
function stripStarfieldFromFrame(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue; // already transparent — skip

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // ✅ Keep: distinctly blue pixels — decorative border lines & filigree corners
    if (b > 80 && b > r + 15 && b > g + 10) continue;

    // ✅ Keep: warm golden/copper pixels — the Jonathon "J" logo
    if (r > 140 && g > 80 && b < 120 && r > b + 50) continue;

    // ❌ Everything else → transparent
    // This includes: white inner/outer fill, starfield dots, dark space background.
    // The starfield is provided by Layer 1 (original frame), so it shows through here.
    data[i + 3] = 0;
  }
}

/**
 * Prepares the TOP frame overlay: starfield stripped, only border + logo remain.
 * This is drawn as the topmost layer so the border always sits over the photo.
 */
export async function prepareFrameOverlay(
  frameSrc: string | HTMLImageElement
): Promise<HTMLImageElement> {
  const frame =
    typeof frameSrc === "string" ? await loadImageElement(frameSrc) : frameSrc;
  const w = frame.naturalWidth;
  const h = frame.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(frame, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  stripStarfieldFromFrame(imageData.data);
  ctx.putImageData(imageData, 0, 0);

  return loadImageElement(canvas.toDataURL("image/png"));
}

/**
 * Composites photo inside the Jonathon frame using 3 layers:
 *
 * Layer 1 (bottom) — originalFrame: the full frame WITH starfield background dots.
 * Layer 2 (middle) — photo: scaled to cover the inner rectangle, strictly clipped
 *                    so it never bleeds over the frame border. Portrait photos fill
 *                    top-to-bottom; excess width is hidden inside the clip region.
 * Layer 3 (top)    — frameOverlay: starfield-stripped frame drawn on top so the
 *                    decorative border always sits above the photo.
 *
 * @param photo          The user's product / person photo.
 * @param frameOverlay   Prepared overlay (border only, starfield removed).
 * @param originalFrame  The raw frame PNG with starfield — used as background.
 * @param insets         Safe-area insets matching the frame's inner border rectangle.
 */
export function compositePhotoInFrame(
  photo: HTMLImageElement,
  frameOverlay: HTMLImageElement,
  originalFrame: HTMLImageElement,
  insets: FrameInsets = JONATHON_FRAME_INSETS
): HTMLCanvasElement {
  const w = frameOverlay.naturalWidth;
  const h = frameOverlay.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Canvas not supported");

  ctx.clearRect(0, 0, w, h);

  // ── Layer 1: Original frame (starfield + border) as background ────────────
  ctx.drawImage(originalFrame, 0, 0, w, h);

  // ── Layer 2: Photo — cover-scale into inner rectangle, strictly clipped ────
  const il = insets.left * w;
  const it = insets.top * h;
  const innerW = w - insets.left * w - insets.right * w;
  const innerH = h - insets.top * h - insets.bottom * h;

  // Enlarge until the photo just touches the inner border — no cropping ever.
  // Each image is different so scaling is calculated dynamically per photo:
  //   - Portrait photo  → touches top & bottom border, starfield shows on sides
  //   - Landscape photo → touches left & right border, starfield shows top/bottom
  //   - Small photo     → enlarged as much as possible until it touches the border
  const scale = Math.max(
    innerW / photo.naturalWidth,
    innerH / photo.naturalHeight
  ) * 1.2; // boost: enlarges photo 20% more inside the frame
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  const dx = il + (innerW - dw) / 2; // centred — equal space left & right
  const dy = it + (innerH - dh) / 2; // centred — equal space top & bottom

  ctx.save();
  ctx.beginPath();
  ctx.rect(il, it, innerW, innerH); // strict clip = exactly the inner border rect
  ctx.clip();
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();

  // ── Layer 3: Frame border overlay on top — border always covers photo edge ─
  ctx.drawImage(frameOverlay, 0, 0, w, h);

  return canvas;
}

export async function canvasToPngFile(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export image"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/png" }));
      },
      "image/png"
    );
  });
}
