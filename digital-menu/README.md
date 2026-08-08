# Gravity58 Digital Menu

This mobile-first restaurant portal includes browser-local restaurant accounts, separate menus, optional preparation instructions, QR menus, customer ordering, order status, reporting and a Gravity58 advertising rail.

Restaurant accounts, menus, settings and orders remain in that browser. The portal **cannot create, approve, pause or delete advertisements**. It only reads campaigns published by the G58 team through Appwrite and links restaurant owners to `/advertise/` for slot booking.

## Local test

From the deployment folder run `python3 -m http.server 8080`, then open:

- Digital Menu: `http://localhost:8080/digital-menu/`
- Advertisement booking: `http://localhost:8080/advertise/`
- Unified team administration: `http://localhost:8080/team-admin/`

## Demo restaurant login

- Email: `demo@g58.in`
- Password: `demo123`

## Appwrite

Edit `config.js` and follow the root `APPWRITE-SETUP.md`. Appwrite is used only for advertising placement keys and published advertisements. Do not expose API keys in frontend code.

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
