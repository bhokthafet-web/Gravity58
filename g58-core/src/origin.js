export function isAllowedOrigin(origin, configuredOrigins = new Set()) {
  if (!origin || configuredOrigins.has(origin)) return true;
  if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  if (/^(?:capacitor|ionic):\/\/localhost(?::\d+)?$/i.test(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (url.hostname === "g58.in" || url.hostname.endsWith(".g58.in"));
  } catch {
    return false;
  }
}
