# 5S Industrial AI operations

## Required configuration

Set these values only in the deployment environment or Secret Manager-backed
runtime configuration. Do not place credentials in source control.

- `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT`: target Google Cloud project.
- `PRISM_5S_DOCUMENTS_BUCKET`: existing private, uniform-access bucket used for
  originals, generated workbooks, and short-lived signed downloads.
- `PRISM_DOCUMENT_AI_PROCESSOR`: approved Document AI processor ID (not a full
  URL).
- `PRISM_DOCUMENT_AI_LOCATION`: Document AI processor location, for example
  `us`; it must match the processor.
- `PRISM_VERTEX_MODEL_ID`: approved multimodal Gemini model available in the
  configured project.
- `PRISM_VERTEX_AI_LOCATION` (or `VERTEX_AI_LOCATION`): Vertex AI region.
- `PRISM_5S_TASK_QUEUE` and `PRISM_5S_TASK_LOCATION`: existing Cloud Tasks
  queue and its location.
- `PRISM_5S_WORKER_URL`: private Cloud Run service URL hosting the worker path.
- `PRISM_5S_WORKER_AUDIENCE`: OIDC audience configured on Cloud Tasks.
- `PRISM_5S_WORKER_TOKEN`: Secret Manager-provided defense-in-depth token for
  the task request; Cloud Run IAM and OIDC remain the primary control.
- `PRISM_PDFTOPPM_BIN` (optional): absolute path to Poppler `pdftoppm`; defaults
  to `pdftoppm`. It rasterizes authorized PDF pages for source annotations.
- `PRISM_5S_PYTHON_BIN` (optional): Python 3 path used by the deterministic
  OpenPyXL company-template renderer; defaults to `python3`.

## Required service-account permissions

Use the existing Cloud Run workload identity. It needs only:

- read/write object access to the designated 5S bucket;
- permission to sign URLs when download URLs are enabled;
- permission to invoke the selected Document AI processor;
- permission to invoke the selected Vertex AI model.
- permission to create tasks in the designated Cloud Tasks queue;
- an OIDC service account authorized to invoke the private Cloud Run worker.

Do not grant public bucket access, Owner, Editor, or browser credentials.

The supplied Dockerfile installs Poppler and the Python requirements include
OpenPyXL and Pillow. These support PDF page rendering and preservation of
approved company-template formatting during export; no browser API key is used.

## Processing behavior

The application sends report bytes to Document AI only after an authenticated,
tenant-authorized user starts analysis. Gemini receives the OCR text and, for
image reports or machinery photos, the corresponding image bytes. Prompt text
explicitly treats source content as untrusted evidence. The output is validated
into PRISM contracts and remains `ai_extracted` or `uncertain` until a human
verification snapshot is created.

The implementation uses the Document AI `processors/*:process` endpoint with
Google application credentials and the installed Vertex AI SDK for Gemini. It
does not use a browser key, provider secret, scraped source, or mocked success
response. JPEG EXIF candidate detection is conservative; image chronology
prefers a readable visible camera watermark and flags disagreement with EXIF.

When either Document AI or Vertex configuration is absent, processing returns a
truthful configuration status and persists no fabricated readings. Uploaded
originals remain private and can be retried after configuration is approved.

## Production verification

1. Create a private bucket and configure lifecycle/retention in the approved
   infrastructure workflow.
2. Configure the processor, model, and workload identity.
3. Upload a non-sensitive reviewed CNC report and timestamped machinery photos.
4. Confirm OCR/Gemini values retain evidence and uncertain values are editable.
5. Resolve timestamp conflicts, verify the report, generate the workbook, and
   confirm `Inspection Report` and `Machinery Images` are in that order.
6. Confirm signed downloads expire and cross-tenant access returns 404/403.
7. Configure the Cloud Tasks queue to use OIDC for the private worker URL and
   test retry behavior with a deliberately invalid processor ID in a non-prod
   environment. Jobs are stored as tenant-scoped `processing-job` records and
   are idempotent once running or completed.

## Stage 3 configuration contract

`PRISM_5S_DOCUMENTS_BUCKET` is the only bucket variable used by Plant Data
Converter. Set it to `aidirac-503309-prism-plant-data-converter` alongside
`GOOGLE_CLOUD_PROJECT=aidirac-503309`. `PRISM_DOCUMENTS_BUCKET` is deliberately
not read as a fallback: it belongs to unrelated PRISM storage integrations and
would risk cross-feature object mixing.

Additional Cloud Tasks settings are now required for asynchronous processing:

- `PRISM_5S_TASK_SERVICE_ACCOUNT`: dedicated same-project account used by Cloud
  Tasks to mint an OIDC ID token.
- `PRISM_5S_WORKER_AUDIENCE`: normally the private worker service URL; it
  defaults to `PRISM_5S_WORKER_URL` when omitted.

`PRISM_5S_WORKER_TOKEN` is optional defense in depth only. OIDC validation and
Cloud Run IAM are the primary controls; a shared token alone cannot enable task
dispatch. The dispatcher sends an OIDC token and uses a 30-minute deadline.

The runtime Docker image installs Python, Poppler, OpenPyXL, Pillow, and
Pillow-HEIF. The deterministic renderer invokes only fixed repository scripts
with temporary paths it created. HEIF support therefore depends on the deployed
image successfully installing `pillow-heif`.

Document AI uses Application Default Credentials with
`processors/*:process`, preserves normalized source coordinates, and retries
bounded transient errors. A Form Parser is the appropriate initial candidate
for OCR, tables, generic fields, and supported handwriting; Enterprise Document
OCR is an alternative when OCR quality analysis is the priority. Gemini model
IDs are intentionally configurable, rather than hardcoded, because model
availability is project-, region-, and release-dependent. The adapters log only
sanitized operation metadata and do not fabricate output when configuration is
absent.

## Read-only Cloud discovery

These PowerShell commands do not create or modify cloud resources:

```powershell
$p = 'aidirac-503309'
gcloud config get-value project
gcloud storage buckets describe gs://aidirac-503309-prism-plant-data-converter --project=$p
gcloud storage buckets get-iam-policy gs://aidirac-503309-prism-plant-data-converter --project=$p
gcloud documentai processors list --project=$p --location=asia-south1
gcloud documentai processors list --project=$p --location=us
gcloud ai models list --project=$p --region=asia-south1 --format='table(displayName,name)'
gcloud ai models list --project=$p --region=us-central1 --format='table(displayName,name)'
gcloud tasks queues list --project=$p --location=asia-south1
gcloud run services list --project=$p --region=asia-south1
```

Use discovery results and Google Cloud's current processor/model documentation
to select an approved resource. Do not create a processor merely because the
list is empty.

## Approval-required cloud changes

Review these with the organizational administrator before running them:

```powershell
$p = 'aidirac-503309'; $region = 'asia-south1'
$runtimeSa = 'RUNTIME_SERVICE_ACCOUNT_EMAIL'
$taskSa = 'TASK_INVOKER_SERVICE_ACCOUNT_EMAIL'
$service = 'PRISM_WORKER_SERVICE_NAME'; $queue = 'prism-5s-processing'
gcloud tasks queues create $queue --project=$p --location=$region --max-attempts=3 --max-retry-duration=1800s --max-backoff=300s
gcloud projects add-iam-policy-binding $p --member="serviceAccount:$runtimeSa" --role='roles/cloudtasks.enqueuer'
gcloud run services add-iam-policy-binding $service --project=$p --region=$region --member="serviceAccount:$taskSa" --role='roles/run.invoker'
gcloud storage buckets add-iam-policy-binding gs://aidirac-503309-prism-plant-data-converter --member="serviceAccount:$runtimeSa" --role='roles/storage.objectUser'
```

The task creator needs `iam.serviceAccounts.actAs` on the task identity. The
Cloud Tasks service agent must be able to mint its token. If Cloud Storage V4
signed URLs are used, grant the runtime a narrowly scoped blob-signing permission
on the signing identity. Do not grant Owner, Editor, public access, or a browser
credential.
