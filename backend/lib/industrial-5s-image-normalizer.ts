import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { MachineryImageAnalysisV1 } from "./industrial-5s";

const run = promisify(execFile);
const python = () => process.env.PRISM_5S_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
export type XlsxImageInput = { image: MachineryImageAnalysisV1; bytes: Buffer };

/** XLSX accepts JPEG/PNG media. Other approved uploads are converted without mutating their private originals. */
export async function normalizeIndustrialImagesForXlsx(images: XlsxImageInput[]): Promise<XlsxImageInput[]> {
  return Promise.all(images.map(async (item, index) => {
    if (item.image.contentType === "image/jpeg" || item.image.contentType === "image/png") return item;
    const folder = await mkdtemp(join(tmpdir(), "prism-5s-image-"));
    try {
      const inputPath = join(folder, `source-${index}`);
      const outputPath = join(folder, "image.png");
      await writeFile(inputPath, item.bytes);
      await run(python(), [join(process.cwd(), "backend", "scripts", "industrial-5s-image-normalize.py"), inputPath, outputPath], { windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 });
      return { image: { ...item.image, contentType: "image/png" }, bytes: await readFile(outputPath) };
    } catch (error) {
      throw new Error(`Machinery image ${item.image.originalFilename} cannot be embedded in Excel: ${error instanceof Error ? error.message : "unsupported image format"}`);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }));
}
