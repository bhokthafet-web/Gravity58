# Appwrite setup for Gravity58 advertising

Create one Appwrite project and add Web platforms for:

- `http://localhost:8080`
- the GitHub Pages hostname
- `https://g58.in`
- `https://www.g58.in`

Create database `gravity58`. Create the following tables with **Row security enabled**. Grant table-level **Create** to `Users`; grant **Read** to `Any` only for `advertisements`, `ad_slots`, and `g58_posts`. The frontend assigns row permissions to the record owner and the configured G58 admin team.

## `ad_customer_profiles`

| Column | Type | Required | Default |
|---|---|---:|---|
| `userId` | varchar(64) | yes | |
| `email` | varchar(320) | yes | |
| `name` | varchar(160) | yes | |
| `phone` | varchar(32) | no | |
| `accountType` | varchar(32) | no | `customer` |
| `state` | varchar(120) | no | |
| `district` | varchar(120) | no | |
| `blocked` | boolean | yes | `false` |

Index `userId` and `email`.

## `ad_slots`

| Column | Type | Required |
|---|---|---:|
| `restaurantKey` | varchar(300) | yes |
| `name` | varchar(180) | yes |
| `city` | varchar(160) | yes |
| `active` | boolean | yes |

Create a unique index on `restaurantKey`. Allow Create for `Guests` as well as `Users`; the Digital Menu creates an anonymous Appwrite session before registering its advertising placement key. Restaurant operational data is not included.

## `ad_bookings`

Create these columns: `customerId`, `customerName`, `customerEmail`, `restaurantKey`, `slotId`, `title`, `destinationUrl`, `status`, `paymentLink`, `adminMessage`, `paymentLinkSentAt`, `proofSentAt`, `activatedAt`, `expiresAt`, `image`, `buttonLabel` as varchar/text; `description` as text; `hours` as integer; `rate` and `amount` as float; `createdAt` as datetime/varchar. Index `customerId`, `restaurantKey`, `status` and `expiresAt`.

## `advertisements`

Create `bookingId`, `restaurantKey`, `slotId`, `title`, `image`, `buttonLabel`, `destinationUrl`, `status`, `activatedAt`, `expiresAt` as varchar/text; `description` as text; `amount` as float; `hours` as integer; `active` as boolean. Index `restaurantKey`, `slotId`, `active` and `expiresAt`. Grant table Read to `Any`; only G58 team row permissions should allow update/delete.

## `g58_posts`

Create `recordKey` varchar(64), `postType` varchar(20), `userId` varchar(64), `payload` text and `updatedAt` varchar/datetime. Create a unique index on `recordKey`, plus indexes on `postType` and `userId`. Each public customer requirement or business advertisement uses its own row, with owner and G58 team permissions; grant table Read to `Any` and Create to `Users`.

## G58 admin team

Create an Appwrite Team named `Gravity58 Administrators`. Add only trusted G58 staff and copy its Team ID into:

- `/js/config.js`
- `/advertise/config.js`
- `/digital-menu/config.js`
- `/team-admin/config.js`

Do not put an Appwrite API key in this repository. Permanent deletion of Appwrite Authentication users should be implemented as a protected Appwrite Function; the static admin portal intentionally cannot use a server API key.
