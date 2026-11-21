import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { env } from "./env";
import { safeFilename, sha256 } from "./industrial-5s";

const configuredBucket = () => process.env.PRISM_5S_DOCUMENTS_BUCKET || "";
const allowed = new Map<string, string[]>([["report", ["application/pdf", "image/jpeg", "image/png", "image/webp"]], ["machinery", ["image/jpeg", "image/png", "image/webp"]], ["template", ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]]]);
export type StoredIndustrialFile = { id: string; storagePath: string; generation?: string; filename: string; contentType: string; size: number; sha256: string };

export function industrialStorageConfigured() { return Boolean(configuredBucket()); }
export function requireIndustrialBucket() { const bucket = configuredBucket(); if (!bucket) throw new Error("5S document storage is not configured. Set PRISM_5S_DOCUMENTS_BUCKET to a private bucket before uploading files."); return bucket; }
export function validateIndustrialUpload(kind: "report" | "machinery" | "template", file: File) {
  const accepted = allowed.get(kind)!; if (!accepted.includes(file.type)) throw new Error(`Unsupported ${kind} file type`);
  const max = kind === "template" ? 15 : 30; if (!file.size || file.size > max * 1024 * 1024) throw new Error(`${kind} files must be smaller than ${max} MB`);
  const filename = safeFilename(file.name, `${kind}-${Date.now()}`); if (!filename.includes(".")) throw new Error("File extension is required"); return filename;
}
export async function storeIndustrialFile(input: { tenantId: string; inspectionId: string; kind: "report" | "machinery" | "template"; file: File }) {
  const filename = validateIndustrialUpload(input.kind, input.file); const bytes = Buffer.from(await input.file.arrayBuffer()); const id = randomUUID(); const extension = filename.split(".").pop()!.toLowerCase(); const segment = input.kind === "machinery" ? "machinery/originals" : input.kind === "template" ? "templates/originals" : "reports/originals";
  const storagePath = `tenants/${safeFilename(input.tenantId)}/inspections/${safeFilename(input.inspectionId)}/${segment}/${id}.${extension}`;
  const bucket = new Storage({ projectId: env.projectId }).bucket(requireIndustrialBucket()); const target = bucket.file(storagePath);
  await target.save(bytes, { resumable: false, contentType: input.file.type, metadata: { cacheControl: "private, max-age=0, no-transform", metadata: { tenantId: input.tenantId, inspectionId: input.inspectionId, objectId: id, originalFilename: filename, sha256: sha256(bytes) } } });
  const [metadata] = await target.getMetadata(); return { id, storagePath, generation: metadata.generation === undefined ? undefined : String(metadata.generation), filename, contentType: input.file.type, size: input.file.size, sha256: sha256(bytes) } satisfies StoredIndustrialFile;
}
export async function readIndustrialFile(storagePath: string) { const [bytes] = await new Storage({ projectId: env.projectId }).bucket(requireIndustrialBucket()).file(storagePath).download(); return bytes; }
export async function storeIndustrialExport(input: { tenantId: string; inspectionId: string; revision: number; filename: string; body: Buffer }) { const safe = safeFilename(input.filename); const path = `tenants/${safeFilename(input.tenantId)}/inspections/${safeFilename(input.inspectionId)}/exports/revision-${String(input.revision).padStart(3, "0")}-${safe}`; const file = new Storage({ projectId: env.projectId }).bucket(requireIndustrialBucket()).file(path); await file.save(input.body, { resumable: false, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", metadata: { cacheControl: "private, max-age=0, no-transform", metadata: { tenantId: input.tenantId, inspectionId: input.inspectionId } } }); return path; }
export async function createIndustrialDownloadUrl(path: string, filename: string) { const [url] = await new Storage({ projectId: env.projectId }).bucket(requireIndustrialBucket()).file(path).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60_000, responseDisposition: `attachment; filename="${safeFilename(filename)}"` }); return { url, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() }; }
