# Gravity58 Digital Menu

This mobile-first restaurant portal includes Gravity58-authenticated restaurant accounts, account-synced menus, optional preparation instructions, QR menus, customer ordering, order status, reporting and a fixed restaurant-specific advertising header.

Restaurant configuration, categories, menu items, availability, customer orders, reports and images sync through the signed-in user’s Appwrite permissions. Restaurant/menu images must be 100 KB or smaller; the dashboard compressor creates a downloadable upload-ready WebP entirely in browser memory. The portal **cannot create, approve, pause or delete advertisements**. It only reads campaigns published by the G58 team and links restaurant owners to `/advertise/` for slot booking.

## Local test

From the deployment folder run `python3 -m http.server 8080`, then open:

- Digital Menu: `http://localhost:8080/digital-menu/`
- Advertisement booking: `http://localhost:8080/advertise/`
- Unified team administration: `http://localhost:8080/team-admin/`

## Appwrite

Production endpoints are defined in `config.js`; follow the root `APPWRITE-SETUP.md` for infrastructure deployment. The shared row-secured table stores account-scoped Digital Menu configuration as `digital_menu_<user-id>` records. Customers receive public-read access; only the authenticated owner can edit or delete the restaurant menu. No API or storage key is exposed in frontend code.

## CSV bulk menu import

Open **Menu CSV**, download the template, complete the menu rows, and import the file. Required columns are `category`, `item_name`, and `price`; optional columns control description, food type, availability, preparation time and preparation instructions. Put local food-image names in `image_file`, select matching JPG/PNG/WebP files of 100 KB or less, and G58 uploads them to Appwrite.

## Customer identification

The entry popup captures customer name, either Single Counter or Table Number, and an optional phone number. The restaurant order card displays exactly that service mode and identification.

## Optional payment

Enable payment in Restaurant Settings and enter a UPI ID or payment link. Online customers submit a transaction ID. The restaurant dashboard must confirm payment before accepting the order.

## Updated customer and payment flow

- For **Single Counter**, customer name is required.
- For **Table Number**, customer name is optional and table number is required.
- Phone number is always optional.
- The category pointed to by the wheel arrow controls the visible menu items.
- When online payment is enabled and a UPI ID is configured, checkout generates an amount-specific UPI QR code.
- Customers enter the UPI transaction ID after payment.
- Restaurant staff must confirm payment before the order can move to Pending and be accepted.
