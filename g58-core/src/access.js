const PUBLIC_KINDS = new Set([
  "advertisements",
  "slots",
  "posts",
  "digital_menus",
  "digital_menu_pricing",
  "digit58_pricing",
]);

const PUBLIC_PREFIXES = [
  "digital_menu_",
  "digit58_store_",
  "digit58_promo_",
  "digit58_service_",
  "digit58_expert_",
];

const PRIVATE_PUBLIC_PREFIX_EXCEPTIONS = new Set([
  "digital_menu_entitlements",
  "digital_menu_requests",
  "digital_menu_orders",
  "digital_menu_subscriptions",
]);

export const isPublicKind = (kind) => PUBLIC_KINDS.has(kind)
  || (!PRIVATE_PUBLIC_PREFIX_EXCEPTIONS.has(kind) && PUBLIC_PREFIXES.some((prefix) => kind.startsWith(prefix)));

export const isAdmin = (user) => ["admin", "super_admin"].includes(user?.role);
export const isStaff = (user) => ["support", "admin", "super_admin"].includes(user?.role);

export const canReadRecord = (record, user) => record.visibility === "public"
  || isStaff(user)
  || record.owner_id === user?.id
  || (user?.id && (record.participant_ids || []).includes(user.id));

export const canWriteRecord = (record, user) => isAdmin(user) || record.owner_id === user?.id;

export const visibilityForKind = (kind) => isPublicKind(kind) ? "public" : "private";
