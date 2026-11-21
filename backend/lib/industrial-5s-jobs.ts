import { GoogleAuth } from "google-auth-library";
import { env } from "./env";

export type IndustrialJob = { id: string; inspectionId: string; tenantId: string; type: "analyze" | "generate"; status: "queued" | "running" | "completed" | "failed" | "exhausted"; attempts: number; maxAttempts: number; createdAt: string; updatedAt: string; error?: string };
const queue = () => process.env.PRISM_5S_TASK_QUEUE || "";
const location = () => process.env.PRISM_5S_TASK_LOCATION || "us-central1";
const workerUrl = () => process.env.PRISM_5S_WORKER_URL || "";
const taskServiceAccount = () => process.env.PRISM_5S_TASK_SERVICE_ACCOUNT || "";
const audience = () => process.env.PRISM_5S_WORKER_AUDIENCE || workerUrl();
/** Cloud Tasks OIDC is mandatory; the legacy shared token, if configured, is defense in depth only. */
export function backgroundJobsConfigured() { return Boolean(queue() && workerUrl() && taskServiceAccount() && audience()); }

export async function enqueueIndustrialJob(job: IndustrialJob) {
  if (!backgroundJobsConfigured()) throw new Error("Cloud Tasks worker configuration is incomplete");
  const auth = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient(); const token = await auth.getAccessToken(); if (!token.token) throw new Error("Unable to obtain Google Cloud access token");
  const parent = `projects/${env.projectId}/locations/${location()}/queues/${queue()}`;
  const target = `${workerUrl().replace(/\/$/, "")}/api/prism/industrial-5s/worker`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.PRISM_5S_WORKER_TOKEN) headers["X-Prism-5S-Worker"] = process.env.PRISM_5S_WORKER_TOKEN;
  const response = await fetch(`https://cloudtasks.googleapis.com/v2/${parent}/tasks`, { method: "POST", headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ task: { httpRequest: { httpMethod: "POST", url: target, headers, oidcToken: { serviceAccountEmail: taskServiceAccount(), audience: audience() }, dispatchDeadline: "1800s", body: Buffer.from(JSON.stringify({ jobId: job.id, inspectionId: job.inspectionId, tenantId: job.tenantId, type: job.type })).toString("base64") } } }) });
  if (!response.ok) throw new Error(`Cloud Tasks enqueue failed (${response.status}): ${(await response.text()).slice(0, 300)}`); return response.json() as Promise<{ name?: string }>;
}
