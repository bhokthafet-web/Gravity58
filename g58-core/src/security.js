import crypto from "node:crypto";
import argon2 from "argon2";

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const tokenHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
export const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const hashPassword = (password) => argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});

export const verifyPassword = (hash, password) => argon2.verify(hash, password);

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    $id: row.id,
    email: row.email || "",
    name: row.name || "",
    phone: row.phone || "",
    role: row.role,
    status: row.status,
    emailVerification: Boolean(row.email_verified_at),
    isGuest: Boolean(row.is_guest),
    $createdAt: row.created_at,
    $updatedAt: row.updated_at,
  };
}
