# Gravity58 GitHub + Appwrite Release

This folder is the production deployment package for the Gravity58 public marketplace, account-synced POS, restaurant Digital Menu, advertisement booking and private team administration.

## Routes

- `/` — public customer and business marketplace
- `/pos/` — Free/Premium POS with unit price × quantity billing
- `/digital-menu/` — restaurant owner dashboard and customer QR menu
- `/advertise/` — Appwrite-authenticated advertisement booking
- `/team-admin/` — Appwrite-team-protected unified G58 administration

## Storage boundary

Restaurant/menu records, live orders, POS settings, bills, cancellations and inventory are account-scoped in G58 Cloud through Appwrite. Restaurant and food images also use Appwrite Storage with public viewing, owner-only update/delete permissions and an application-enforced 100 KB limit. The dashboard compressor processes images only in browser memory and lets the owner download an upload-ready WebP. Appwrite also stores public marketplace/advertisement records, advertiser authentication, ad bookings, targeting keys and published campaigns.

## Deployment

The production Appwrite project and G58 administrator team IDs are already configured. See [APPWRITE-SETUP.md](APPWRITE-SETUP.md) for the deployed advertising-data schema and storage boundary.

1. Push this folder to the `main` branch of the GitHub repository.
2. In repository Settings → Pages, select **GitHub Actions**.
3. Point the `g58.in` DNS records to GitHub Pages after the first successful deployment.

GitHub Actions deploys this static folder automatically after every push to `main`.
