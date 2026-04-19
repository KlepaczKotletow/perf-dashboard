/**
 * Guard against open-redirect via the `target_path` stored in
 * `dashboard_link_tokens`. Tokens are minted server-side today, but treating
 * the stored value as untrusted defends against a future bug or compromise.
 *
 * Only allow paths that:
 *   - start with a single `/` (not `//...` protocol-relative)
 *   - are scoped under /dashboard
 *   - contain no `..` traversal
 *   - contain no backslashes (Windows/UNC tricks)
 *   - contain no control characters
 */
export function isValidTargetPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.startsWith("//")) return false; // protocol-relative URL
  if (!path.startsWith("/dashboard")) return false;
  if (path.includes("\\")) return false; // backslash / UNC
  if (path.includes("..")) return false; // path traversal
  if (/[\x00-\x1f]/.test(path)) return false; // control chars
  return true;
}
