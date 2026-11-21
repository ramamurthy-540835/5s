import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const run = promisify(execFile);
const binary = () => process.env.PRISM_PDFTOPPM_BIN || "pdftoppm";
const pageNumber = (value: number) => Number.isInteger(value) && value > 0 && value <= 10_000 ? value : undefined;

/** Source bboxes use Document AI normalized coordinates: left, top, right, bottom in [0, 1]. */
export function annotationRect(bbox: [number, number, number, number], rotation: number) {
  const [left, top, right, bottom] = bbox; const width = right - left; const height = bottom - top;
  if (![left, top, right, bottom].every(Number.isFinite) || left < 0 || top < 0 || right > 1 || bottom > 1 || width <= 0 || height <= 0) throw new Error("Invalid normalized source bounding box");
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 0) return { left, top, width, height };
  if (normalized === 90) return { left: 1 - bottom, top: left, width: height, height: width };
  if (normalized === 180) return { left: 1 - right, top: 1 - bottom, width, height };
  if (normalized === 270) return { left: top, top: 1 - right, width: height, height: width };
  throw new Error("PDF rotation must be a multiple of 90 degrees");
}

export async function renderPdfPage(input: { bytes: Buffer; page: number; dpi?: number }) {
  const page = pageNumber(input.page); if (!page) throw new Error("Invalid PDF page"); const dpi = Math.min(240, Math.max(72, Math.round(input.dpi || 144)));
  const folder = await mkdtemp(join(tmpdir(), "prism-5s-pdf-")); const source = join(folder, "source.pdf"); const prefix = join(folder, "page");
  try { await writeFile(source, input.bytes); await run(binary(), ["-f", String(page), "-l", String(page), "-r", String(dpi), "-png", "-singlefile", source, prefix], { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 }); return await readFile(`${prefix}.png`); }
  catch { throw new Error("PDF page rendering is unavailable. Configure PRISM_PDFTOPPM_BIN in this environment."); }
  finally { await rm(folder, { recursive: true, force: true }); }
}
