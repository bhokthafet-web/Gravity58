# G58 self-hosted Appwrite setup

Appwrite stores public posts, advertising accounts, bookings, placements, active campaigns, restaurant/menu configuration, restaurant orders, POS workspaces and all restaurant/menu images. Restaurant owners never receive or configure storage credentials.

## Production project

- Project: `Gravity58`
- Hosting: G58 managed VPS
- Project ID: `6a776883001717bca81c`
- Endpoint: `https://server.g58.in/v1`
- Admin team: `Gravity58 Administrators`
- Admin team ID: `6a776960001ca2fb66bf`

## Database

Create database `gravity58` with one row-secured table:

### `g58_records`

| Column | Type | Required |
|---|---|---:|
| `kind` | text | yes |
| `payload` | text | yes |

Create a key index named `kind_idx` on `kind`.

Enable row security. Grant table-level **Create** to authenticated users. Public records receive `read("any")` at row level; private advertiser profiles and bookings receive owner and G58 administrator-team permissions only.

The supported record types are `posts`, `profiles`, `bookings`, `advertisements`, `slots`, `digital_menu_<authenticated-user-id>`, `digital_order_<restaurant-owner-id>` and `pos_workspace_<authenticated-user-id>`. Digital Menu rows are public-read for customer QR links and owner-only for update/delete. Orders are readable only by the customer session and restaurant owner. POS workspace rows are owner-only.

## Restaurant and menu images

Use the configured Appwrite Storage bucket `ad-media`. The application accepts only JPG, PNG or WebP restaurant/menu files that are 100 KB or smaller. Each file receives public read access and update/delete access only for its authenticated owner. Advertisement media retains its separate file-type and size validation. The Digital Menu dashboard provides a browser-memory-only compressor that downloads an upload-ready WebP and never sends the source image to a server.

## Platforms

Register these Web hostnames:

- `g58.in`
- `www.g58.in`
- `bhokthafet-web.github.io`

Do not put an Appwrite API key in this repository. Permanent deletion of Appwrite Authentication users should be implemented as a protected Appwrite Function; the static admin portal intentionally cannot use a server API key.

This is a fresh production backend. Existing Appwrite Cloud rows and files are intentionally not migrated.
