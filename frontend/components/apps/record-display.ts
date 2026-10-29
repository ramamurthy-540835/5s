export function displayRecordValue(key: string, value: unknown) {
  if (key === "documents") {
    const documents = Array.isArray(value) ? value : [];
    const names = documents
      .map((document) => document && typeof document === "object" ? String((document as { name?: unknown }).name || "Uploaded file") : "Uploaded file")
      .slice(0, 3);
    return names.length ? `${documents.length} private file${documents.length === 1 ? "" : "s"}: ${names.join(", ")}${documents.length > names.length ? " …" : ""}` : "0 private files";
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (value && typeof value === "object") return "Stored details";
  return String(value);
}
