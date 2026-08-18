/**
 * DESIGN.md v2.0 "one export pattern" rule — every client-side file download in
 * the app goes through this helper instead of a per-screen Blob/data-URI variant.
 * Answers a verbatim competitor complaint: "Downloading of the reports in
 * PDF/Excel Format - not very uniform."
 */
export function downloadFile(contents: string, filename: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convenience wrapper for the common case: pretty-printed JSON export. */
export function downloadJson(data: unknown, filename: string): void {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}
