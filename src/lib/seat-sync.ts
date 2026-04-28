import crypto from "node:crypto";

export function signSeatSync(workspaceId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify({ workspace_id: workspaceId }))
    .digest("hex");
}

export function verifySeatSync(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
