/**
 * Never leak raw error messages to clients — they can expose SQL schema,
 * internal paths, or credentials referenced in stack traces. Log the raw
 * error server-side; return a generic message to the user.
 */
// Signature accepts `err` for future use (e.g. structured logging of
// specific error classes) even though the returned message is constant.
export function sanitizeExportError(err: unknown): string {
  void err;
  return "Failed to export analytics";
}
