# Gravity58 Production Release

This folder is the production deployment package for Gravity58 Refills, Digital Stay, account-synced POS, restaurant Digital Menu, advertisement booking and private team administration.

## Routes

- `/` — product landing page
- `/pos/` — Free/Premium POS with unit price × quantity billing
- `/digital-menu/` — restaurant owner dashboard and customer QR menu
- `/advertise/` — authenticated advertisement booking
- `/team-admin/` — role-protected unified G58 administration

## Architecture

GitHub Pages hosts the public website. The self-hosted G58 Core service at `server.g58.in` provides accounts, password recovery, role-based access, PostgreSQL records, media, live updates, secure actions and the private team console. No third-party backend API is required.

Restaurant/menu records, live orders, bookings, POS settings, bills, cancellations, inventory and advertisements are account-scoped in G58 Core. Uploaded media is stored on the G58 server with owner-aware access rules. The menu-image compressor processes source images only in browser memory before upload.

## Deployment

The production endpoint is configured as `https://server.g58.in/api/v1`. Backend deployment and operating instructions are in [`g58-core/README.md`](g58-core/README.md).

1. Push this folder to the `main` branch of the GitHub repository.
2. In repository Settings → Pages, select **GitHub Actions**.
3. Point the `g58.in` DNS records to GitHub Pages after the first successful deployment.

GitHub Actions deploys this static folder automatically after every push to `main`.
