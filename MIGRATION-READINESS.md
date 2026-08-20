# Gravity58 Backend Migration Readiness

Reference document for moving off Appwrite Cloud in the future (to self-hosted Appwrite,
or a custom backend). Written from a full audit of the codebase as of 2026-08-20.
Keep this updated whenever a new Appwrite kind, permission pattern, Function, or bucket
is introduced — it's the single place that answers "what does our backend actually look
like" without re-deriving it from source every time.

## 0. Architecture in one paragraph

Every app (root site, `digit58/` = Refills, `digital-menu/`, `pos/`, `advertise/`,
`team-admin/`, `support/`) talks to Appwrite **directly from the browser** via the
Appwrite Web SDK — there is no backend-for-frontend API layer of our own. All data lives
in **one physical Appwrite table** (`g58_records`, `TablesDB`), with a `kind` string
attribute used as a logical partition key (see `js/appwrite-ads.js:100-124`). Access
control is enforced entirely through Appwrite's per-row `Permission`/`Role` grants set at
write time — there is no server-side authorization layer beyond that (except the few
actions routed through the `create-digital-order` Appwrite Function, which run with
elevated/server privileges).

**Practical implication for migration:** you are not migrating "a database" so much as
migrating (a) an Appwrite project's auth users, (b) one table's rows partitioned by
`kind`, (c) one Storage bucket, (d) one Appwrite Function, (e) one Team. If you self-host
Appwrite, all of this ports over via Appwrite's own backup/restore tooling. If you move to
a custom backend, every item below has to be reimplemented by hand.

## 1. Project configuration (single source of truth, currently duplicated 5×)

Canonical values (from `js/config.js`):

```js
endpoint:              "https://sgp.cloud.appwrite.io/v1"
projectId:              "6a776883001717bca81c"
databaseId:              "gravity58"
adminTeamId:              "6a776960001ca2fb66bf"
sharedTableId:              "g58_records"
mediaBucketId:              "ad-media"
digitalOrderFunctionId:      "create-digital-order"
```

**⚠️ These exact values are duplicated, byte-for-byte, across 5 files** — each app has
its own config.js because each exports a differently-named global (`GRAVITY58_CONFIG`,
`GRAVITY58_AD_BOOKING_CONFIG`, `GRAVITY58_AD_ADMIN_CONFIG`):

- `js/config.js` → `window.GRAVITY58_CONFIG`
- `digit58/config.js` → `window.GRAVITY58_CONFIG`
- `digital-menu/config.js` → `window.GRAVITY58_CONFIG`
- `advertise/config.js` → `window.GRAVITY58_AD_BOOKING_CONFIG`
- `team-admin/config.js` → `window.GRAVITY58_AD_ADMIN_CONFIG`

If a future migration changes any of these IDs (e.g. self-hosting gives you a new
`projectId`), **all 5 files must be updated identically** or one app will silently break
against the old project. Confirmed consistent as of this audit. Not consolidated into one
shared file yet because every app currently loads its own `config.js` before
`appwrite-ads.js`, and changing that load order/structure touches every page's `<head>` —
worth doing carefully as its own change, not bundled into this doc.

Appwrite Web SDK version: **`26.2.0`**, loaded identically via CDN
(`cdn.jsdelivr.net/npm/appwrite@26.2.0`) on every page that talks to Appwrite. Consistent
across the whole site — no version drift. **When self-hosting, confirm the target Appwrite
server version supports the `TablesDB` API** (`js/appwrite-ads.js:93` — the client checks
`Appwrite.TablesDB` and falls back to the older `Appwrite.Databases` API if unavailable;
self-hosting an older Appwrite version would silently downgrade to the legacy
collection/document model instead of the shared-table model this app expects).

## 2. Static kind names (one Appwrite row "type" per line)

| Kind | Purpose |
|---|---|
| `advertisements` | Ad-booking creative records |
| `bookings` | Ad slot bookings |
| `profiles` | Customer account profiles |
| `slots` | Ad placement slots (restaurants) |
| `posts` | Customer/Business Wall posts |
| `digital_menu_pricing` | Digital Menu plan pricing |
| `digital_menu_entitlements` | Digital Menu subscription status per owner |
| `digital_menu_requests` | Digital Menu upgrade/plan requests |
| `digit58_owners` | Refills store owner registry/summary rows |
| `digit58_requests` | Refills subscription (activation) requests |
| `digit58_entitlements` | Refills store subscription/entitlement status |
| `digit58_pricing` | Refills subscription plan pricing |
| `digit58_card_purchases` | Refills promotion-card purchase records |
| `digit58_brand_requests` | Brand-partner onboarding requests |
| `digit58_brand_owners` | Brand-owner accounts |
| `support_tickets` | Cross-app support tickets |
| `g58_contact_requests` | Public contact-form submissions (from `/contact/`) |

## 3. Dynamic, per-owner kinds

All built as `` `${PREFIX}${sanitize(ownerId)}` ``, where
`sanitize = String(ownerId||fallback).replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,max)`.
The `max` is how many characters of the *ownerId* are kept — client and server helpers
must agree on this number or the same owner produces two different kind strings.

| Prefix | Max chars | Client helper | Server helper (`appwrite-functions/create-digital-order/src/main.js`) |
|---|---|---|---|
| `digit58_store_` | 40 | `digit58/app.js:85` (`storeKind`) | `digit58StoreKind`, line 46 |
| `digit58_customer_` | 36 | `digit58/app.js:86` (`customerKind`) | `digit58CustomerKind`, line 43 |
| `digit58_card_` | 40 | `digit58/app.js:87` (`cardKind`) | `digit58CardKind`, line 44 |
| `digit58_order_` | 40 | `digit58/app.js:88` (`orderKind`) | `digit58OrderKind`, line 45 |
| `digit58_promo_` | 40 | `digit58/app.js:89` (`promotionKind`) | `digit58PromotionKind`, line 47 |
| `digit58_course_` | 39 | `digit58/app.js:90` (`courseKind`) | `digit58CourseKind`, line 48 |
| `digit58_push_` | 40 | *(server only — no client helper)* | `digit58PushKind`, line 49 |
| `digit58_fcm_` | 40 | *(server only — no client helper)* | `digit58FcmKind`, line 50 |
| `pos_workspace_` | 45 | `js/pos-premium.js:51` / `js/app.js:2403` (`posWorkspaceSafeId`) | — |
| `digital_menu_` | 48 | `digital-menu/app-v11.js:203` (`cloudMenuKind`) / `js/pos-premium.js:53` | `menuKind`, line 41 |
| `digital_order_` | 47 | `digital-menu/app-v11.js:204` / `js/pos-premium.js:54` / `team-admin/app.js:195` | `orderKind`, line 39 |
| `digital_token_` | 47 | `digital-menu/app-v11.js:205` (`cloudTokenKind`) | `tokenKind`, line 40 |
| `digital_subscription_` | 43 | `digital-menu/app-v11.js:151` (`ownerSubscriptionKind`) | `subscriptionKind`, line 42 |

**Caveat:** `digit58_push_` and `digit58_fcm_` are written/read only by the
`create-digital-order` Function via raw REST calls — no client code ever calls
`Gravity58Ads.list/get/create/update/remove` with these kinds directly.

## 4. Permission model (`js/appwrite-ads.js`)

Four helper functions build the `Permission[]` array passed to every `create`/some
`update` calls. **This logic has to be reimplemented as real authorization code if you
ever move off Appwrite** — right now "who can read/write what" lives entirely in these
four functions plus the public-read allowlist below, not in any server code.

- **`permissionSet(kind, userId, includeAdminTeam)`** (`js/appwrite-ads.js:35`) — the
  default. Grants the owning user read/update/delete, optionally the admin team
  read/update/delete, and — if `kind` matches the public allowlist below — public read.
- **`userPermissionSet(userIds)`** (`js/appwrite-ads.js:50`) — grants read/update/delete
  to each user ID in a list (two-party records, e.g. a subscription shared by a customer
  and an owner). No public or admin-team grant.
- **`collaborativePermissionSet(userId)`** (`js/appwrite-ads.js:57`) — grants
  read+update to **any authenticated account** (`Role.users()`), plus full
  read/update/delete to the creator. This is the "any logged-in Appwrite session,
  including anonymous ones, can see/edit it" pattern used for self-serve records like
  Refills activation requests.
- **`managedPermissionSet()`** (`js/appwrite-ads.js:73`) — grants read to all
  authenticated users plus full control to the admin team. **Exported but no call site
  found anywhere in the codebase** — treat as dead code, confirm before relying on it.

**Public-read allowlist** (`js/appwrite-ads.js:38`) — exact condition:
```js
const readAny = ["advertisements", "slots", "posts", "digital_menus", "digital_menu_pricing"].includes(kind)
  || String(kind).startsWith("digital_menu_") && !["digital_menu_entitlements", "digital_menu_requests"].includes(kind)
  || String(kind).startsWith("digit58_store_")
  || String(kind).startsWith("digit58_promo_");
```
So: `advertisements`, `slots`, `posts`, `digital_menu_pricing` are always public; any
`digital_menu_<ownerId>` menu row is public *except* the entitlements/requests kinds; any
`digit58_store_<ownerId>` or `digit58_promo_<ownerId>` row is public. Everything else
(orders, customers, entitlements, requests, support tickets, `profiles`, `bookings`) is
private to its owner (+ admin team).

**Flagged:** `digital_menus` (plural) appears in the allowlist but no code anywhere
creates/reads a kind with that exact name — likely dead/legacy, left in place
deliberately since removing it is a behavior change, not a migration-prep task.

## 5. Storage

**One bucket exists: `ad-media`** (`js/appwrite-ads.js:14`, default `mediaBucketId`).
Used for ad creative uploads, payment receipts, and Digital Menu item photos — three
call sites (`uploadAdMedia`, `uploadPaymentReceipt`, `uploadMenuMedia`,
`js/appwrite-ads.js:291/314/332`). No other bucket referenced anywhere in the codebase.

## 6. Appwrite Function

**One Function: `create-digital-order`**
(source: `appwrite-functions/create-digital-order/src/main.js`, ~1179 lines). Every
privileged/server-side action funnels through this one Function via
`executeFunction(functionId, {action, ...})` (`js/appwrite-ads.js:336`). This is the part
of the backend that is **not** just Appwrite config — it's real application code that has
to be redeployed (with its env vars/secrets) on whatever runs Functions in the new
environment. Known actions dispatched to it (client call sites):

`rate-business-card`, `delete-business-rating`, `touch-business-card`,
`raise-support-ticket`, `digit58-set-store-suspended`, `digit58-accept-owner-order`,
`digit58-reject-owner-order`, `digit58-list-customer-stores`, `digit58-accept-policy`,
`digit58-create-card`, `digit58-owner-create-order`, `digit58-save-push-subscription`,
`digit58-save-fcm-token`, `digit58-link-customer`, `digit58-create-refill-order`,
`digit58-reorder`, `digit58-create-course`, `digit58-add-medicine`,
`digit58-create-order`, `confirm-payment`, `create-subscription`,
`send-subscription-link`, `submit-subscription-payment`, `confirm-subscription-payment`.

The function source also implements a scheduled FCM push job and periodic cleanup
(`purgeInactiveBusinessCards`, `purgeExpiredDigit58Promotions`) — these run on Appwrite's
Function scheduler, which has no equivalent unless you set up cron on the new host.

**Note:** the full action list above was cross-referenced from client call sites only,
against the first 854 of 1179 lines of the server file — the tail of that file (medicine/
course workflows and beyond) wasn't re-verified against this list at audit time.

## 7. Teams / admin role

Single Team: `adminTeamId = "6a776960001ca2fb66bf"`. Membership in this team is the *only*
definition of "is a G58 admin" in the entire app — checked via
`teams.get({teamId})` succeeding (`js/appwrite-ads.js:356`, `isTeamAdmin()`), and it's
what gates the entire `team-admin/` app (`team-admin/app.js:8`). A custom-backend
migration needs a real `role`/`is_admin` column (or equivalent) to replace this.

## 8. Realtime

All realtime goes through `Gravity58Ads.subscribeKind(kind, onChange)`
(`js/appwrite-ads.js:366`), which wraps `client.subscribe()` on a
`databases.{db}.tables.{table}.rows` channel and filters client-side by `kind`. Used for:
live order status on the POS/owner dashboards, Digital Menu owner + customer order
tracking, and the advertisements feed. A custom backend needs websockets (or polling) to
replace this — there's no REST fallback currently wired for these live views.

**Not realtime, despite the name:** `Gravity58DB.subscribe()` (`js/database.js:67`) is a
local `CustomEvent`/`storage`-event pub-sub, not an Appwrite channel — don't confuse the
two when tracing "what updates live."

## 9. The one thing Appwrite will never let you export: passwords

Auth user password hashes are not retrievable via any Appwrite API or SDK, by design. If
you migrate to **self-hosted Appwrite**, use Appwrite's own project backup/restore
tooling — it moves auth data (including password hashes) as an internal snapshot, not
through the public API, so accounts survive intact. If you ever migrate to a **non-
Appwrite** backend, there is no way around a forced password reset or a "verify against
old system on next login, migrate silently" bridge for all ~50k accounts — plan the
UX for that separately, it isn't a database problem.

## 10. Pre-migration checklist

- [ ] Confirm target Appwrite version supports `TablesDB` (§1)
- [ ] Decide whether to consolidate the 5 duplicate config files before or after migration (§1)
- [ ] Export/redeploy `create-digital-order` Function source + env vars + secrets on the new host (§6)
- [ ] Recreate the scheduled push/cleanup job trigger (§6) — this is Appwrite's Function scheduler, not part of any data export
- [ ] Verify the `ad-media` bucket and its files transfer with stable file IDs (§5)
- [ ] Verify the admin Team and its memberships transfer (§7)
- [ ] If not self-hosting Appwrite: budget real engineering time for auth migration (§9), permission-model reimplementation (§4), and realtime replacement (§8) — these are the three genuinely hard parts, not the data itself
