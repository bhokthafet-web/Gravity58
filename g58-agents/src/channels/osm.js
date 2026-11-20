import { config } from "../config.js";
import { normalizeIndianPhone } from "../phone.js";

const AMENITY = new Set(["restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream", "food_court", "pharmacy", "dentist", "clinic", "doctors"]);

// Everyday Indian names for shops, mapped to the OpenStreetMap tags they are filed under.
const CATEGORY_ALIASES = {
  medical: ["pharmacy", "chemist", "medical_supply"],
  medicals: ["pharmacy", "chemist", "medical_supply"],
  medical_shop: ["pharmacy", "chemist", "medical_supply"],
  medical_store: ["pharmacy", "chemist", "medical_supply"],
  pharmacy: ["pharmacy", "chemist", "medical_supply"],
  pharmacies: ["pharmacy", "chemist", "medical_supply"],
  drugstore: ["pharmacy", "chemist"],
  kirana: ["convenience", "supermarket"],
  kirana_store: ["convenience", "supermarket"],
  grocery: ["convenience", "supermarket", "greengrocer"],
  general_store: ["convenience", "supermarket"],
  salon: ["hairdresser", "beauty"],
  saloon: ["hairdresser", "beauty"],
  parlour: ["beauty", "hairdresser"],
  beauty_parlour: ["beauty", "hairdresser"],
  hotel: ["restaurant", "fast_food"],
  tiffin: ["fast_food", "restaurant"],
  tiffins: ["fast_food", "restaurant"],
  mess: ["restaurant", "fast_food"],
  dhaba: ["restaurant"],
  biryani: ["restaurant", "fast_food"],
  tea: ["cafe"],
  chai: ["cafe"],
  coffee: ["cafe"],
  sweets: ["confectionery", "pastry", "bakery"],
  sweet_shop: ["confectionery", "pastry", "bakery"],
  mobile: ["mobile_phone"],
  mobile_shop: ["mobile_phone"],
  mobiles: ["mobile_phone"],
  jewellery: ["jewelry"],
  jewellers: ["jewelry"],
  optical: ["optician"],
  opticals: ["optician"],
  textiles: ["clothes", "fabric"],
  textile: ["clothes", "fabric"],
  sarees: ["clothes", "fabric"],
  footwear: ["shoes"],
  meat: ["butcher"],
  chicken: ["butcher"],
  laundry: ["laundry", "dry_cleaning"],
  dry_cleaning: ["dry_cleaning", "laundry"],
  doctor: ["doctors", "clinic"],
  clinic: ["clinic", "doctors"],
  dental: ["dentist"],
  hardware: ["hardware", "doityourself"],
  electrical: ["electrical", "electronics"],
};

/** Turns what the owner typed ("Medicals, kirana stores") into map tags, without duplicates. */
export function expandCategories(categories) {
  const out = [];
  for (const raw of categories) {
    const word = String(raw).toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^a-z_]/g, "");
    if (!word) continue;
    const singular = word.endsWith("s") ? word.slice(0, -1) : word;
    out.push(...(CATEGORY_ALIASES[word] ?? CATEGORY_ALIASES[singular] ?? [word]));
  }
  return [...new Set(out)];
}

// Only fetch places that list some phone number; keeps the public Overpass server happy.
const HAS_PHONE = '[~"^(phone|contact:phone|contact:mobile|contact:whatsapp)$"~"."]';

const tagKey = (category) => (AMENITY.has(category) ? "amenity" : "shop");

/** Builds an Overpass query for named businesses of the given categories inside a city boundary. */
export function buildQuery(city, categories) {
  const safeCity = String(city).replace(/["\\]/g, "");
  const selectors = categories
    .map((category) => String(category).replace(/[^a-z_]/g, ""))
    .filter(Boolean)
    .map((category) => `nwr(area.city)["${tagKey(category)}"="${category}"]["name"]${HAS_PHONE};`)
    .join("\n  ");
  return `[out:json][timeout:180];
area["name"="${safeCity}"]["boundary"="administrative"]->.city;
(
  ${selectors}
);
out center tags;`;
}

/** Turns Overpass elements into lead rows. Businesses with no usable phone are dropped. */
export function toLeads(elements, city) {
  const leads = [];
  for (const element of elements ?? []) {
    const tags = element.tags ?? {};
    const phone = normalizeIndianPhone(tags["contact:whatsapp"] || tags.phone || tags["contact:phone"] || tags["contact:mobile"]);
    if (!phone || !tags.name) continue;
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
      .filter(Boolean).join(", ");
    leads.push({
      sourceRef: `osm:${element.type}/${element.id}`,
      name: tags.name,
      category: tags.amenity || tags.shop || "",
      phone,
      email: tags.email || tags["contact:email"] || null,
      website: tags.website || tags["contact:website"] || null,
      address,
      city,
      lat: element.lat ?? element.center?.lat ?? null,
      lon: element.lon ?? element.center?.lon ?? null,
    });
  }
  return leads;
}

async function fetchOverpass(query) {
  const errors = [];
  for (const url of config.overpassUrls) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "g58-agents/0.1 (admin@g58.in)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(200_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()).elements;
    } catch (error) {
      errors.push(`${new URL(url).host}: ${error.message}`);
    }
  }
  throw new Error(`All Overpass servers failed (${errors.join("; ")})`);
}

/**
 * One request per category: a single query for a whole city is too heavy for the
 * public Overpass servers. Returns the leads found plus the categories that failed.
 */
export async function searchBusinesses(city, categories) {
  const leads = [];
  const failed = [];
  for (const category of categories) {
    try {
      leads.push(...toLeads(await fetchOverpass(buildQuery(city, [category])), city));
    } catch (error) {
      failed.push(`${category}: ${error.message}`);
    }
  }
  if (!leads.length && failed.length) throw new Error(failed.join(" | "));
  return { leads, failed };
}

// ---------- Area search for email outreach ----------

const HAS_EMAIL_OR_SITE = '[~"^(email|contact:email|website|contact:website)$"~"."]';

/** Looks up an area such as "Kukatpally, Hyderabad" and returns its bounding box [south, west, north, east]. */
export async function geocodeArea(area) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: area, format: "json", limit: "1", countrycodes: "in" }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": "g58-agents/0.1 (admin@g58.in)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Area lookup failed (HTTP ${response.status})`);
  const [place] = await response.json();
  if (!place) throw new Error(`Could not find "${area}" on the map. Try adding the city, e.g. "Kukatpally, Hyderabad".`);
  let [south, north, west, east] = place.boundingbox.map(Number);
  // Keep very large areas (a whole state) to about 50 km around the centre.
  const maxSpan = 0.45;
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (north - south > maxSpan) [south, north] = [lat - maxSpan / 2, lat + maxSpan / 2];
  if (east - west > maxSpan) [west, east] = [lon - maxSpan / 2, lon + maxSpan / 2];
  return { bbox: [south, west, north, east].map((n) => Number(n.toFixed(5))), label: place.display_name };
}

/** One query for all business types: much faster on the public servers than one per type. */
export function buildAreaQuery(bbox, categories) {
  const clean = [...new Set(categories.map((c) => String(c).replace(/[^a-z_]/g, "")).filter(Boolean))];
  const amenity = clean.filter((c) => tagKey(c) === "amenity");
  const shop = clean.filter((c) => tagKey(c) === "shop");
  const box = bbox.join(",");
  const statements = [
    amenity.length && `nwr["amenity"~"^(${amenity.join("|")})$"]["name"]${HAS_EMAIL_OR_SITE}(${box});`,
    shop.length && `nwr["shop"~"^(${shop.join("|")})$"]["name"]${HAS_EMAIL_OR_SITE}(${box});`,
  ].filter(Boolean);
  return `[out:json][timeout:150];
(
  ${statements.join("\n  ")}
);
out center tags;`;
}

/** Businesses with an email or website tag, any phone. Email may be null (to be found on the website). */
export function toEmailCandidates(elements, area) {
  return (elements ?? []).filter((element) => element.tags?.name).map((element) => {
    const tags = element.tags;
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
      .filter(Boolean).join(", ");
    const email = String(tags.email || tags["contact:email"] || "").split(/[;,\s]/)[0].toLowerCase() || null;
    return {
      sourceRef: `osm:${element.type}/${element.id}`,
      name: tags.name,
      category: tags.amenity || tags.shop || "",
      phone: normalizeIndianPhone(tags.phone || tags["contact:phone"] || tags["contact:mobile"]),
      email: email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) ? email : null,
      website: tags.website || tags["contact:website"] || null,
      address,
      city: area,
      lat: element.lat ?? element.center?.lat ?? null,
      lon: element.lon ?? element.center?.lon ?? null,
    };
  });
}

export async function searchAreaForEmails(bbox, categories, area) {
  try {
    return { found: toEmailCandidates(await fetchOverpass(buildAreaQuery(bbox, categories)), area), failed: [] };
  } catch (error) {
    // Busy servers sometimes reject the combined query; smaller per-type queries may still get through.
    const found = [];
    const failed = [];
    for (const category of categories) {
      try {
        found.push(...toEmailCandidates(await fetchOverpass(buildAreaQuery(bbox, [category])), area));
      } catch (inner) {
        failed.push(`${category}: ${inner.message}`);
      }
    }
    if (!found.length && failed.length) throw new Error(`The map servers are busy, please try again in a few minutes (${error.message})`);
    return { found, failed };
  }
}

// ---------- Call / visit list (businesses without email) ----------

export function buildVisitQuery(bbox, categories) {
  const clean = [...new Set(categories.map((c) => String(c).replace(/[^a-z_]/g, "")).filter(Boolean))];
  const amenity = clean.filter((c) => tagKey(c) === "amenity");
  const shop = clean.filter((c) => tagKey(c) === "shop");
  const box = bbox.join(",");
  const statements = [
    amenity.length && `nwr["amenity"~"^(${amenity.join("|")})$"]["name"](${box});`,
    shop.length && `nwr["shop"~"^(${shop.join("|")})$"]["name"](${box});`,
  ].filter(Boolean);
  return `[out:json][timeout:150];
(
  ${statements.join("\n  ")}
);
out center tags 2000;`;
}

/** Name, address, phone and map link for each business, grouped by locality and street. */
export function toVisitRows(elements) {
  const rows = (elements ?? []).filter((e) => e.tags?.name).map((e) => {
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const rawPhone = t.phone || t["contact:phone"] || t["contact:mobile"] || "";
    const mobile = normalizeIndianPhone(rawPhone);
    return {
      name: t.name,
      category: t.amenity || t.shop || "",
      locality: t["addr:suburb"] || t["addr:neighbourhood"] || t["addr:district"] || "",
      street: t["addr:street"] || "",
      address: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], t["addr:postcode"]].filter(Boolean).join(", "),
      phone: mobile ? `+${mobile}` : String(rawPhone).split(/[;,]/)[0].trim(),
      email: t.email || t["contact:email"] || "",
      website: t.website || t["contact:website"] || "",
      map: lat != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : "",
    };
  });
  const key = (r) => `${r.locality || "~"}|${r.street || "~"}|${r.name}`.toLowerCase();
  return rows.sort((a, b) => key(a).localeCompare(key(b)));
}

export async function visitList(bbox, categories) {
  return toVisitRows(await fetchOverpass(buildVisitQuery(bbox, categories)));
}
