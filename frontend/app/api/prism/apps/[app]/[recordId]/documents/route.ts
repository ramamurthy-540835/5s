import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";
import { getSession } from "@backend/lib/auth";
import { ensureSeeded } from "@backend/lib/bootstrap";
import { env } from "@backend/lib/env";
import { queryBigQuery } from "@backend/lib/bigquery";
import { appOrgId } from "@backend/lib/app-tenancy";

const table = `\`${env.projectId}.${env.dataset}.app_records\``;
const types = new Set(["property_image", "ownership_document", "sale_deed", "encumbrance_certificate", "authorization_letter"]);
const mimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maximumBytes = 10 * 1024 * 1024;

type Listing = { id: string; owner_id: string; status: string; payload_json: string };
type DocumentReference = { id: string; type: string; name: string; contentType: string; size: number; storagePath: string; uploadedAt: string };
const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function listingForUser(recordId: string, user: { id: string; orgId: string; role: "admin" | "member" }) {
  const orgId = appOrgId("property-auctions", user);
  const rows = await queryBigQuery<Listing>(`SELECT id,owner_id,status,payload_json FROM ${table}
    WHERE id=@recordId AND org_id=@orgId AND app='property-auctions' AND kind='listing' LIMIT 1`, { recordId, orgId });
  const listing = rows[0];
  if (!listing) return { response: error("Property listing not found", 404) };
  if (user.role !== "admin" && listing.owner_id !== user.id) return { response: error("Listing unavailable", 403) };
  return { listing };
}

export async function POST(req: Request, { params }: { params: { app: string; recordId: string } }) {
  const user = getSession(req);
  if (!user) return error("Sign in required", 401);
  if (params.app !== "property-auctions" || !/^[a-f0-9-]{36}$/.test(params.recordId)) return error("Property listing not found", 404);
  await ensureSeeded();
  const found = await listingForUser(params.recordId, user);
  if (found.response) return found.response;
  const listing = found.listing!;
  const orgId = appOrgId("property-auctions", user);
  if (user.role !== "admin" && !["draft", "review", "changes_requested", "rejected"].includes(listing.status))
    return error("Documents can only be uploaded before a listing is approved", 409);

  let form: FormData;
  try { form = await req.formData(); } catch { return error("Multipart form data required"); }
  const documentType = String(form.get("documentType") || "");
  const document = form.get("document");
  if (!types.has(documentType)) return error("Choose a supported document type");
  if (!(document instanceof File) || !document.size) return error("Choose a document to upload");
  if (document.size > maximumBytes) return error("Documents must be 10 MB or smaller", 413);
  if (!mimeTypes.has(document.type)) return error("Only PDF, JPEG, and PNG documents are supported");
  if (documentType === "property_image" && document.type === "application/pdf") return error("Property images must be JPEG or PNG files");

  const extension = document.type === "application/pdf" ? "pdf" : document.type === "image/jpeg" ? "jpg" : "png";
  const documentId = randomUUID();
  const storagePath = `property-auctions/${orgId}/${listing.id}/${documentId}.${extension}`;
  const uploadedAt = new Date().toISOString();
  const reference: DocumentReference = { id: documentId, type: documentType, name: document.name.slice(0, 180), contentType: document.type, size: document.size, storagePath, uploadedAt };
  const file = new Storage({ projectId: env.projectId }).bucket(env.propertyAuctionDocumentsBucket).file(storagePath);
  try {
    await file.save(Buffer.from(await document.arrayBuffer()), {
      resumable: false,
      contentType: document.type,
      metadata: { cacheControl: "private, max-age=0, no-transform", metadata: { orgId, listingId: listing.id, documentId } },
    });
    const payload = JSON.parse(listing.payload_json || "{}") as Record<string, unknown>;
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    documents.push(reference);
    await queryBigQuery(`UPDATE ${table} SET payload_json=@payloadJson,updated_at=CURRENT_TIMESTAMP() WHERE id=@recordId AND org_id=@orgId`,
      { recordId: listing.id, orgId, payloadJson: JSON.stringify({ ...payload, documents }) });
  } catch {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    return error("Document upload failed", 503);
  }
  return NextResponse.json({ document: { ...reference, storagePath: undefined } }, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { app: string; recordId: string } }) {
  const user = getSession(req);
  if (!user) return error("Sign in required", 401);
  if (params.app !== "property-auctions" || !/^[a-f0-9-]{36}$/.test(params.recordId)) return error("Property listing not found", 404);
  const documentId = new URL(req.url).searchParams.get("documentId") || "";
  if (!/^[a-f0-9-]{36}$/.test(documentId)) return error("Document ID required");
  await ensureSeeded();
  const found = await listingForUser(params.recordId, user);
  if (found.response) return found.response;
  const payload = JSON.parse(found.listing!.payload_json || "{}") as Record<string, unknown>;
  const document = (Array.isArray(payload.documents) ? payload.documents : []).find((item): item is DocumentReference =>
    !!item && typeof item === "object" && (item as DocumentReference).id === documentId);
  const prefix = `property-auctions/${appOrgId("property-auctions", user)}/${params.recordId}/`;
  if (!document || !document.storagePath.startsWith(prefix)) return error("Document not found", 404);
  try {
    const [url] = await new Storage({ projectId: env.projectId }).bucket(env.propertyAuctionDocumentsBucket).file(document.storagePath)
      .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 5 * 60_000, responseDisposition: `attachment; filename="${document.name.replace(/["\\]/g, "_")}"` });
    return NextResponse.json({ url, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), name: document.name });
  } catch {
    return error("Document is currently unavailable", 503);
  }
}
