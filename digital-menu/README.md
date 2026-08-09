# Gravity58 Digital Menu

This mobile-first restaurant portal includes Gravity58-authenticated restaurant accounts, account-synced menus, optional preparation instructions, QR menus, customer ordering, order status, reporting and a Gravity58 advertising rail.

Restaurant configuration, categories, menu items, availability and menu images sync through the signed-in user’s Appwrite permissions. Customer orders and reports continue to remain in the browser. The portal **cannot create, approve, pause or delete advertisements**. It only reads campaigns published by the G58 team through Appwrite and links restaurant owners to `/advertise/` for slot booking.

## Local test

From the deployment folder run `python3 -m http.server 8080`, then open:

- Digital Menu: `http://localhost:8080/digital-menu/`
- Advertisement booking: `http://localhost:8080/advertise/`
- Unified team administration: `http://localhost:8080/team-admin/`

## Demo restaurant login

- Email: `demo@g58.in`
- Password: `demo123`

## Appwrite

Edit `config.js` and follow the root `APPWRITE-SETUP.md`. The shared row-secured table stores account-scoped Digital Menu configuration as `digital_menu_<user-id>` records. Customers receive public-read access; only the authenticated owner can edit or delete the restaurant menu. No API key is exposed in frontend code.

## CSV bulk menu import

Open **Menu Setup**, download the CSV template, complete the menu rows, and import the file. Required columns are `category`, `item_name`, and `price`; optional columns control description, food type, availability, preparation time, preparation instructions and an HTTPS image URL.

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
