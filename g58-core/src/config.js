import path from "node:path";

const required = (name, fallback = "") => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const integer = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric environment variable: ${name}`);
  return value;
};

export const config = Object.freeze({
  env: process.env.NODE_ENV || "development",
  port: integer("PORT", 8088),
  databaseUrl: required("DATABASE_URL", "postgres://g58:g58@localhost:5432/g58"),
  cookieName: process.env.SESSION_COOKIE || "g58_session",
  cookieDomain: process.env.SESSION_DOMAIN || "",
  sessionDays: integer("SESSION_DAYS", 30),
  publicApiUrl: process.env.PUBLIC_API_URL || "http://localhost:8088",
  publicSiteUrl: process.env.PUBLIC_SITE_URL || "http://localhost:3000",
  allowedOrigins: new Set((process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:8088").split(",").map((value) => value.trim()).filter(Boolean)),
  mediaRoot: path.resolve(process.env.MEDIA_ROOT || "./data/media"),
  maxMediaBytes: integer("MAX_MEDIA_BYTES", 15 * 1024 * 1024),
  maxMenuImageBytes: integer("MAX_MENU_IMAGE_BYTES", 100 * 1024),
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: integer("SMTP_PORT", 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "Gravity58 <no-reply@g58.in>",
  },
  bootstrapAdmin: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || "",
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "",
  },
});
