// Reads a business's own website to find its public contact email.
import dns from "node:dns/promises";
import net from "node:net";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

const PRIVATE_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
];

const v4ToInt = (ip) => ip.split(".").reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits)));
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return lower === "::" || lower === "::1" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

/** Only public http(s) sites on standard ports, so a bad website tag can't reach our own servers. */
async function assertPublicUrl(url) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("not http(s)");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("non-standard port");
  if (url.username || url.password) throw new Error("credentials in URL");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

async function fetchPage(rawUrl) {
  let url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`);
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; g58-agents/0.1; +https://g58.in)", Accept: "text/html" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location"), url);
      continue;
    }
    if (!response.ok || !/text\/html|xhtml/i.test(response.headers.get("content-type") || "")) return null;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    return { url, html: Buffer.concat(chunks).toString("utf8") };
  }
  return null;
}

const JUNK_DOMAINS = /(example\.(com|org)|domain\.com|email\.com|yourdomain|sentry|wixpress\.com|godaddy\.com|wordpress\.(com|org)|schema\.org|w3\.org)$/i;
const JUNK_EXT = /\.(png|jpe?g|gif|webp|svg|css|js|ico)$/i;
const FREE_MAIL = /^(gmail|googlemail|yahoo|yahoo\.co|ymail|outlook|hotmail|live|msn|rediffmail|icloud|me|aol|zoho|protonmail|proton)\.(com|in|co\.in|me)$/i;

// Cloudflare hides emails as a hex string XOR-ed with its first byte.
const decodeCfEmail = (hex) => {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
};

/** All plausible email addresses in a page, best first: same domain as the site, then others. */
export function extractEmails(html, siteHost = "") {
  const found = new Set();
  const add = (email) => {
    const clean = email.trim().replace(/^mailto:/i, "").split("?")[0].replace(/[.,;:]+$/, "").toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return;
    if (JUNK_EXT.test(clean) || JUNK_DOMAINS.test(clean.split("@")[1])) return;
    found.add(clean);
  };
  for (const match of html.matchAll(/mailto:([^"'>\s]+)/gi)) {
    try { add(decodeURIComponent(match[1])); } catch { add(match[1]); }
  }
  for (const match of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) add(decodeCfEmail(match[1]));
  for (const match of html.replace(/<[^>]+>/g, " ").matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) add(match[0]);

  const host = siteHost.replace(/^www\./, "").toLowerCase();
  const ownDomain = (email) => {
    const domain = email.split("@")[1];
    return Boolean(host) && (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`));
  };
  // Other companies' addresses (web designers, partners, the hosting platform) are dropped,
  // so we never email the wrong business. Owners often use personal mail providers.
  return [...found]
    .filter((email) => ownDomain(email) || FREE_MAIL.test(email.split("@")[1]))
    .sort((a, b) => Number(ownDomain(b)) - Number(ownDomain(a)));
}

function contactLinks(html, base) {
  const links = new Set();
  for (const match of html.matchAll(/href="([^"#]*(contact|about|reach)[^"#]*)"/gi)) {
    try {
      const url = new URL(match[1], base);
      if (url.host === base.host) links.add(url.href);
    } catch { /* ignore bad links */ }
  }
  return [...links].slice(0, 2);
}

/** Looks at the home page, then up to two contact/about pages. Returns an email or null. */
export async function findEmailOnWebsite(website) {
  try {
    const home = await fetchPage(website);
    if (!home) return null;
    let emails = extractEmails(home.html, home.url.hostname);
    if (emails.length) return emails[0];
    for (const link of contactLinks(home.html, home.url)) {
      const page = await fetchPage(link);
      if (!page) continue;
      emails = extractEmails(page.html, home.url.hostname);
      if (emails.length) return emails[0];
    }
  } catch {
    // Unreachable, slow or blocked sites are simply skipped.
  }
  return null;
}
