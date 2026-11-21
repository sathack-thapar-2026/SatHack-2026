import { randomBytes } from "node:crypto";

/** Collision-resistant id, e.g. tx_1763745000000_a1b2c3d4 (timestamp keeps ids roughly sortable). */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

/** Unguessable invitation token matching the client-side format: inv_ + 16 lowercase chars/digits. */
export function newInvitationToken(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length];
  return `inv_${out}`;
}

export const INVITATION_TOKEN_PATTERN = /^inv_[a-z0-9]{16}$/;
