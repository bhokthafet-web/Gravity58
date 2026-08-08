# Gravity58 Unified Team Admin

This is the only administration portal in the release. Access requires an Appwrite Email/Password account that belongs to the configured `Gravity58 Administrators` Team; there is no shared or embedded administrator password.

It manages advertisement bookings, payment links, campaign activation and expiry, public customer posts, business cards, advertiser profiles and restaurant advertising placements. Follow the root `APPWRITE-SETUP.md` and never put an Appwrite API key in frontend code.

Permanent deletion of an Appwrite Authentication user requires a protected Appwrite Function. The browser portal can safely block profiles and delete database records, but it cannot contain server credentials.
