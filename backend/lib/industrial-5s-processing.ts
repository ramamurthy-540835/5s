import { analyzeMachineryImage, extractExifDateTime, extractFilenameDateTime, extractIndustrialInspection, industrialAiConfigured } from "./industrial-5s-ai";
import { readIndustrialFile } from "./industrial-5s-storage";
import { sortImageTimeline, type IndustrialInspectionExtractionV1, type MachineryImageAnalysisV1 } from "./industrial-5s";

export type StoredUpload = { id: string; kind: "report" | "machinery"; storagePath: string; contentType: string; filename: string; uploadSequence: number };
export async function processIndustrialInspection(input: { inspectionId: string; siteTimezone: string; uploads: StoredUpload[] }) {
  if (!industrialAiConfigured()) throw new Error("Document AI processor and Vertex AI model configuration are required before processing");
  const reports = input.uploads.filter((upload) => upload.kind === "report"); if (!reports.length) throw new Error("No inspection report files are available for analysis");
  const extraction: IndustrialInspectionExtractionV1 = await extractIndustrialInspection({ inspectionId: input.inspectionId, documents: await Promise.all(reports.map(async (upload) => ({ assetId: upload.id, contentType: upload.contentType, bytes: await readIndustrialFile(upload.storagePath) }))) });
  const images: MachineryImageAnalysisV1[] = await Promise.all(input.uploads.filter((upload) => upload.kind === "machinery").map(async (upload) => { const bytes = await readIndustrialFile(upload.storagePath); return analyzeMachineryImage({ imageId: upload.id, uploadSequence: upload.uploadSequence, originalFilename: upload.filename, objectPath: upload.storagePath, contentType: upload.contentType, imageCategory: "unclassified", imageDescription: undefined, bytes, timezone: input.siteTimezone, exifCandidate: extractExifDateTime(bytes, input.siteTimezone, upload.contentType), filenameCandidate: extractFilenameDateTime(upload.filename, input.siteTimezone) }); }));
  return { extraction, images: sortImageTimeline(images) };
}
