/**
 * Triggers a browser download for an in-memory Blob. General-purpose — any module that
 * generates a file (Excel export, CSV, …) should use this instead of hand-rolling the
 * object-URL + anchor dance.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
