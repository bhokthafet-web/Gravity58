# Gravity58 GitHub + Appwrite Release

This folder is the production deployment package for the Gravity58 public marketplace, local-first POS, restaurant Digital Menu, advertisement booking and private team administration.

## Routes

- `/` — public customer and business marketplace
- `/pos/` — Free/Premium POS with unit price × quantity billing
- `/digital-menu/` — restaurant owner dashboard and customer QR menu
- `/advertise/` — Appwrite-authenticated advertisement booking
- `/team-admin/` — Appwrite-team-protected unified G58 administration

## Storage boundary

Restaurant bills, menu, inventory, restaurant settings, customer orders and reports stay in that browser's `localStorage`. Appwrite is used only for public marketplace/advertisement records, advertiser authentication, ad bookings, targeting keys and published campaigns.

## Before production

1. Complete [APPWRITE-SETUP.md](APPWRITE-SETUP.md).
2. Replace `YOUR_APPWRITE_PROJECT_ID` and `YOUR_G58_TEAM_ID` in all four config files.
3. Push this folder to the `main` branch of the GitHub repository.
4. In repository Settings → Pages, select **GitHub Actions**.
5. Point the `g58.in` DNS records to GitHub Pages after the first successful deployment.

GitHub Actions deploys this static folder automatically after every push to `main`.
