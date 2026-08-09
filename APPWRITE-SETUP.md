# Appwrite setup for Gravity58 advertising and Digital Menu

Gravity58 keeps POS bills, inventory, Digital Menu customer orders and reports in the active browser. Appwrite stores public posts, advertising accounts, bookings, placements, active campaigns, and authenticated restaurant/menu configuration that must be available across devices.

## Production project

- Project: `Gravity58`
- Region: Singapore
- Project ID: `6a776883001717bca81c`
- Endpoint: `https://sgp.cloud.appwrite.io/v1`
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

The supported record types are `posts`, `profiles`, `bookings`, `advertisements`, `slots`, and `digital_menu_<authenticated-user-id>`. Digital Menu rows contain only restaurant configuration, categories and menu items. They are public-read for customer QR links and owner-only for update/delete.

## Platforms

Register these Web hostnames:

- `g58.in`
- `www.g58.in`
- `bhokthafet-web.github.io`

Do not put an Appwrite API key in this repository. Permanent deletion of Appwrite Authentication users should be implemented as a protected Appwrite Function; the static admin portal intentionally cannot use a server API key.
