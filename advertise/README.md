# Gravity58 Advertisement Booking

This G58-authenticated customer portal allows advertisers to select a restaurant placement and number of hours, submit a booking, receive a payment link, send proof and follow the campaign status and expiry timer.

Configure the public G58 Core endpoint in `config.js`. Account, booking and campaign records use the first-party G58 backend; no server secret or administrator password belongs in this frontend.

The G58 team reviews and activates requests only through `/team-admin/`.
