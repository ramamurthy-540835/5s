import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { CompanyTemplateDefinitionV1, MachineryImageAnalysisV1, VerifiedInspectionSnapshotV1 } from "./industrial-5s";

const run = promisify(execFile);
const python = () => process.env.PRISM_5S_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
export type TemplateImage = { image: MachineryImageAnalysisV1; bytes: Buffer };

/** Preserves approved workbook layout through OpenPyXL; unsafe formula targets are rejected by the worker. */
export async function renderCompanyTemplateWorkbook(input: { template: CompanyTemplateDefinitionV1; templateBytes: Buffer; snapshot: VerifiedInspectionSnapshotV1; images: TemplateImage[] }) {
  const folder = await mkdtemp(join(tmpdir(), "prism-5s-template-")); const templatePath = join(folder, "template.xlsx"); const outputPath = join(folder, "output.xlsx"); const requestPath = join(folder, "request.json");
  try {
    await writeFile(templatePath, input.templateBytes); const images = await Promise.all(input.images.map(async ({ image, bytes }, index) => { const extension = image.contentType === "image/png" ? "png" : "jpg"; const localPath = join(folder, `image-${index + 1}.${extension}`); await writeFile(localPath, bytes); return { ...image, localPath }; }));
    await writeFile(requestPath, JSON.stringify({ templatePath, outputPath, fieldMappings: input.template.fieldMappings, fields: input.snapshot.extraction.fields, processRows: input.snapshot.extraction.processRows, images }));
    await run(python(), [join(process.cwd(), "backend", "scripts", "industrial-5s-template-render.py"), requestPath], { windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 }); const result = await readFile(outputPath); if (result.subarray(0, 4).toString("hex") !== "504b0304") throw new Error("Template renderer did not create a valid XLSX workbook"); return result;
  } catch (error) { throw new Error(`Company template rendering failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  finally { await rm(folder, { recursive: true, force: true }); }
}
