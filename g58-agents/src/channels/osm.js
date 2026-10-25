import { config } from "../config.js";
import { normalizeIndianPhone } from "../phone.js";

const AMENITY = new Set(["restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream", "food_court", "pharmacy", "dentist", "clinic"]);

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
