import { createHash } from "crypto";

/** Versioned, provider-neutral contracts for the 5S Industrial AI workflow. */
export const INDUSTRIAL_5S_SCHEMA_VERSION = "1.0";
export type InspectionStatus = "DRAFT" | "UPLOADING" | "PROCESSING" | "NEEDS_REVIEW" | "READY_FOR_VERIFICATION" | "VERIFIED" | "GENERATING" | "COMPLETED" | "FAILED" | "ARCHIVED";
export type ReviewStatus = "ai_extracted" | "uncertain" | "user_verified" | "user_corrected" | "missing" | "calculated";
export type TemplateStatus = "draft" | "under_review" | "published" | "archived";
export type TimestampSource = "visible_watermark" | "exif" | "filename" | "user_confirmed" | "unresolved";

export type SourceProvenance = { assetId: string; page?: number; bbox?: [number, number, number, number]; regionId?: string; method: "document_ai" | "gemini" | "exif" | "filename" | "manual" | "calculated"; estimatedReviewIndicator?: number };
export type ExtractedField = {
  fieldKey: string; sourceLabel?: string; rawText?: string; normalizedValue?: string | number | boolean | null; valueType: "text" | "number" | "date" | "time" | "duration" | "measurement" | "boolean";
  unit?: string; provenance: SourceProvenance[]; alternatives?: string[]; ambiguityNotes?: string[]; validationIssues?: string[]; reviewStatus: ReviewStatus;
  correctedValue?: string | number | boolean | null; correctedBy?: string; correctedAt?: string;
};
export type ProcessStudyRow = { rowId: string; sequenceNumber?: number; stageNumber?: string; processElement?: string; startTime?: string; endTime?: string; stopwatchReading?: string; elapsedMinutes?: number; spindleRpm?: number; feed?: string; depthOfCut?: string; materialStock?: string; numberOfPasses?: number; nvaActivity?: string; cuttingToolReference?: string; remarks?: string; provenance: SourceProvenance[]; reviewStatus: ReviewStatus };
export type IndustrialInspectionExtractionV1 = { schemaVersion: "1.0"; inspectionId: string; documentType: string; documentClassificationStatus: "proposed" | "confirmed" | "unknown"; fields: ExtractedField[]; processRows: ProcessStudyRow[]; additionalNotes: ExtractedField[]; validationIssues: ValidationIssue[]; sourceAssets: string[]; extractionVersion: string; agentVersion: string };
export type ValidationIssue = { code: string; severity: "blocking" | "warning"; message: string; fieldKey?: string; sourceAssetId?: string };

export type TemplateFieldMapping = { canonicalField: string; label: string; target: string; required?: boolean; repeatable?: "process_rows" | "maintenance_events"; format?: "text" | "date" | "time" | "number" | "duration" };
export type CompanyTemplateDefinitionV1 = { schemaVersion: "1.0"; templateId: string; companyId?: string; templateName: string; templateDescription: string; inspectionType: string; templateVersion: string; status: TemplateStatus; source: "platform_generic" | "company_import" | "company_designed"; requiredFields: string[]; fieldMappings: TemplateFieldMapping[]; imageLayout: { widthPx: number; rowHeight: number; requireChronology: boolean }; createdAt: string; publishedAt?: string };

export type TimestampCandidate = { source: Exclude<TimestampSource, "unresolved">; rawValue: string; localDateTime?: string; timezone?: string; valid: boolean; warning?: string };
export type MachineryImageAnalysisV1 = { schemaVersion: "1.0"; imageId: string; uploadSequence: number; originalFilename: string; objectPath: string; contentType: string; watermarkDetected: boolean; watermarkRawText?: string; timestampCandidates: TimestampCandidate[]; resolvedCaptureDatetime?: string; timezone?: string; timestampSource: TimestampSource; timestampStatus: "verified" | "needs_review" | "unresolved" | "conflict"; imageCategory: string; imageDescription?: string; warnings: string[]; agentVersion: string };
export type VerifiedInspectionSnapshotV1 = { schemaVersion: "1.0"; inspectionId: string; snapshotVersion: number; template: Pick<CompanyTemplateDefinitionV1, "templateId" | "templateVersion" | "templateName">; extraction: IndustrialInspectionExtractionV1; images: MachineryImageAnalysisV1[]; verifiedBy: string; verifiedAt: string };
export type ExcelGenerationRequestV1 = { schemaVersion: "1.0"; inspectionId: string; tenantId: string; snapshot: VerifiedInspectionSnapshotV1; outputFilename: string };
export type ExcelGenerationResultV1 = { schemaVersion: "1.0"; inspectionId: string; outputPath: string; outputFilename: string; sha256: string; size: number; exportRevision: number; generatedAt: string; imageCount: number };
export type AgentRun<T> = { agent: "Industrial Document Intelligence Agent" | "Company Template Intelligence Agent" | "Industrial Excel and Image Intelligence Agent"; version: string; status: "completed" | "needs_external_configuration" | "needs_review"; result?: T; warnings: string[] };

const requiredCncFields = ["report_reference_number", "inspection_date", "machine_asset_number", "machine_name"];
export const defaultCncTemplate = (): CompanyTemplateDefinitionV1 => ({
  schemaVersion: "1.0", templateId: "platform-cnc-process-time-v1", templateName: "CNC Process Time Verification", templateDescription: "Approved generic CNC process-time study template. Review and verify all extracted readings before export.", inspectionType: "cnc_process_time_study", templateVersion: "1.0", status: "published", source: "platform_generic", requiredFields: requiredCncFields,
  fieldMappings: [
    { canonicalField: "report_reference_number", label: "Report Reference", target: "B5", required: true }, { canonicalField: "company_name", label: "Company", target: "B6" }, { canonicalField: "site_name", label: "Site", target: "B7" }, { canonicalField: "machine_asset_number", label: "Machine Asset Number", target: "B10", required: true }, { canonicalField: "machine_name", label: "Machine Name", target: "B11", required: true }, { canonicalField: "inspection_date", label: "Inspection Date", target: "B12", required: true }, { canonicalField: "operator_name", label: "Operator", target: "B13" }, { canonicalField: "part_number", label: "Part Number", target: "B14" }, { canonicalField: "part_name", label: "Part Name", target: "B15" }, { canonicalField: "process_name", label: "Process", target: "B16" },
    { canonicalField: "process_rows", label: "Process Time Study", target: "A20", repeatable: "process_rows" },
  ], imageLayout: { widthPx: 520, rowHeight: 250, requireChronology: false }, createdAt: new Date(0).toISOString(), publishedAt: new Date(0).toISOString(),
});

export function validateInspectionTransition(current: InspectionStatus, next: InspectionStatus) {
  const allowed: Record<InspectionStatus, InspectionStatus[]> = { DRAFT: ["UPLOADING", "PROCESSING", "ARCHIVED"], UPLOADING: ["DRAFT", "PROCESSING", "FAILED"], PROCESSING: ["NEEDS_REVIEW", "READY_FOR_VERIFICATION", "FAILED"], NEEDS_REVIEW: ["PROCESSING", "READY_FOR_VERIFICATION", "ARCHIVED"], READY_FOR_VERIFICATION: ["VERIFIED", "PROCESSING", "ARCHIVED"], VERIFIED: ["GENERATING", "PROCESSING", "ARCHIVED"], GENERATING: ["COMPLETED", "FAILED"], COMPLETED: ["PROCESSING", "ARCHIVED"], FAILED: ["DRAFT", "PROCESSING", "ARCHIVED"], ARCHIVED: [] };
  return allowed[current].includes(next);
}

export function safeFilename(value: string, fallback = "inspection-report.xlsx") { const cleaned = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[_ .]+|[_ .]+$/g, "").slice(0, 180); return cleaned || fallback; }
export function sha256(value: Buffer | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
export function parseLocalTimestamp(raw: string, timezone?: string): TimestampCandidate {
  const normalized = raw.trim().replace(/\./g, "-").replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/) || normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return { source: "visible_watermark", rawValue: raw, valid: false, timezone, warning: "Unrecognized local timestamp format" };
  const y = match[1].length === 4 ? +match[1] : +match[3], m = match[1].length === 4 ? +match[2] : +match[2], d = match[1].length === 4 ? +match[3] : +match[1], h = +match[4], minute = +match[5], s = +(match[6] || 0);
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || minute > 59 || s > 59) return { source: "visible_watermark", rawValue: raw, valid: false, timezone, warning: "Invalid timestamp components" };
  return { source: "visible_watermark", rawValue: raw, localDateTime: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(s).padStart(2, "0")}`, timezone, valid: true };
}
export function resolveImageTimestamp(candidates: TimestampCandidate[], uploadSequence: number): Pick<MachineryImageAnalysisV1, "resolvedCaptureDatetime" | "timezone" | "timestampSource" | "timestampStatus" | "warnings"> {
  const usable = candidates.filter((item) => item.valid && item.localDateTime); const watermark = usable.find((item) => item.source === "visible_watermark"); const exif = usable.find((item) => item.source === "exif");
  const conflict = !!watermark && !!exif && watermark.localDateTime !== exif.localDateTime;
  const chosen = watermark || usable.find((item) => item.source === "user_confirmed") || exif || usable.find((item) => item.source === "filename");
  return chosen ? { resolvedCaptureDatetime: chosen.localDateTime, timezone: chosen.timezone, timestampSource: chosen.source, timestampStatus: conflict ? "conflict" : chosen.source === "user_confirmed" ? "verified" : "needs_review", warnings: conflict ? ["Visible watermark and EXIF capture time disagree; verify before chronological export."] : [] } : { timestampSource: "unresolved", timestampStatus: "unresolved", warnings: ["No reliable capture timestamp was found. Upload time was not used."] };
}
export function sortImageTimeline(images: MachineryImageAnalysisV1[]) { return [...images].sort((a, b) => { const at = a.resolvedCaptureDatetime ? Date.parse(a.resolvedCaptureDatetime) : Number.POSITIVE_INFINITY; const bt = b.resolvedCaptureDatetime ? Date.parse(b.resolvedCaptureDatetime) : Number.POSITIVE_INFINITY; return at - bt || a.uploadSequence - b.uploadSequence; }); }
/** Agent 1 boundary. OCR/model execution is deliberately denied unless both approved integrations are configured. */
export function runIndustrialDocumentIntelligence(input: Pick<IndustrialInspectionExtractionV1, "inspectionId" | "sourceAssets">): AgentRun<IndustrialInspectionExtractionV1> {
  if (!process.env.PRISM_DOCUMENT_AI_PROCESSOR || !process.env.PRISM_VERTEX_MODEL_ID) return { agent: "Industrial Document Intelligence Agent", version: "1.0", status: "needs_external_configuration", warnings: ["Set an approved Document AI processor and Vertex model ID. No document content was inferred."] };
  return { agent: "Industrial Document Intelligence Agent", version: "1.0", status: "needs_review", result: { schemaVersion: "1.0", inspectionId: input.inspectionId, documentType: "unknown", documentClassificationStatus: "unknown", fields: [], processRows: [], additionalNotes: [], validationIssues: [{ code: "MODEL_ADAPTER_PENDING", severity: "blocking", message: "The approved model adapter must return schema-validated evidence before verification." }], sourceAssets: input.sourceAssets, extractionVersion: "1.0", agentVersion: "industrial-document-intelligence/1.0" }, warnings: ["Configured model identifiers are present, but no provider-specific extraction adapter has been approved in this deployment."] };
}
/** Agent 2 is deterministic: it only recommends published, tenant-authorized templates supplied by the caller. */
export function runCompanyTemplateIntelligence(input: { inspectionType: string; templates: CompanyTemplateDefinitionV1[]; companyId?: string }): AgentRun<{ recommendedTemplate?: CompanyTemplateDefinitionV1; explanation: string }> {
  const eligible = input.templates.filter((item) => item.status === "published" && (!item.companyId || item.companyId === input.companyId)); const match = eligible.find((item) => item.inspectionType === input.inspectionType) || eligible[0]; return { agent: "Company Template Intelligence Agent", version: "1.0", status: match ? "completed" : "needs_review", result: { recommendedTemplate: match, explanation: match ? `Recommended because the approved template matches ${input.inspectionType}.` : "No approved company template is available." }, warnings: match ? [] : ["An authorized administrator must publish a compatible company template."] };
}
/** Agent 3's image phase is deterministic until an approved watermark OCR adapter supplies candidates. */
export function runIndustrialExcelAndImageIntelligence(input: Omit<MachineryImageAnalysisV1, "resolvedCaptureDatetime" | "timezone" | "timestampSource" | "timestampStatus" | "warnings"> & { timezone?: string }): AgentRun<MachineryImageAnalysisV1> {
  const resolution = resolveImageTimestamp(input.timestampCandidates, input.uploadSequence); return { agent: "Industrial Excel and Image Intelligence Agent", version: "1.0", status: resolution.timestampStatus === "unresolved" || resolution.timestampStatus === "conflict" ? "needs_review" : "completed", result: { ...input, ...resolution, schemaVersion: "1.0", agentVersion: "industrial-excel-image-intelligence/1.0" }, warnings: resolution.warnings };
}
export function validateVerifiedSnapshot(snapshot: VerifiedInspectionSnapshotV1): ValidationIssue[] { const issues: ValidationIssue[] = []; const fields = new Map(snapshot.extraction.fields.map((field) => [field.fieldKey, field])); for (const required of defaultCncTemplate().requiredFields) { const field = fields.get(required); const value = field?.correctedValue ?? field?.normalizedValue; if (snapshot.template.templateId === defaultCncTemplate().templateId && (value === null || value === undefined || value === "")) issues.push({ code: "REQUIRED_FIELD_MISSING", severity: "blocking", fieldKey: required, message: `${required.replace(/_/g, " ")} must be verified before export.` }); }
  for (const image of snapshot.images) if (image.timestampStatus === "conflict") issues.push({ code: "IMAGE_TIMESTAMP_CONFLICT", severity: "blocking", sourceAssetId: image.imageId, message: "Resolve conflicting image timestamp evidence before export." }); return issues;
}
