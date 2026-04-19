/**
 * Never leak raw error messages to clients — they can expose SQL schema,
 * internal paths, or credentials referenced in stack traces. Log the raw
 * error server-side; return a generic message to the user.
 */
export function sanitizeExportError(_err: unknown): string {
  return "Failed to export analytics";
}
