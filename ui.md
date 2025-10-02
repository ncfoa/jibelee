## P2P Delivery Platform — UI Specification

This document defines all end-user UIs for a peer‑to‑peer delivery platform (not a marketplace). It covers sender and courier experiences, global components, page‑level layouts, actions, modals, and states. Think of the breadth of Amazon’s polish applied to on‑demand and scheduled parcel delivery between individuals and small businesses.

## Table of Contents
- Landing & Public
  - Landing Page
  - Track Package (Public)
  - Pricing & Fees (Public)
  - Help Center & FAQs (Public)
- Authentication & Onboarding
  - Sign Up / Sign In / 2FA / Reset Password
  - Sender Onboarding
  - Courier Onboarding (KYC)
- Sender App
  - Sender Dashboard
  - Create Delivery (Multi‑Step Booking)
  - Live Tracking (Sender View)
  - My Deliveries (List & Detail)
  - Address Book
  - Wallet & Payments
  - Invoices & Billing
  - Messages / Chat
  - Notifications Center
  - Support & Disputes
- Courier App
  - Courier Dashboard
  - Delivery Feed / Offers
  - Active Delivery Flow
  - Map & Navigation
  - Earnings & Payouts
  - Ratings & Reviews
  - Vehicle & Documents
  - Availability Schedule
- Cross‑App
  - Global Navigation (Header, Sidebar, Footer)
  - Settings (Profile, Notifications, Security, Privacy)
  - Legal Pages
  - Error & Empty States

## Global Design Patterns
- **Buttons**: Primary (solid), Secondary (outlined), Tertiary (text), Destructive (danger). All have loading, disabled, and tooltip states.
- **Modals**: Centered, with clear primary action on the right, escape/click‑outside rules; confirm dialogs use destructive styling for irreversible actions.
- **Toasts**: Success (green), Info (blue), Warning (yellow), Error (red); auto‑dismiss with focus‑trap support for screen readers.
- **Forms**: Inline validation, input masks (phone, currency), progress save (drafts), error summary at top.
- **Maps**: Pin selectors for addresses, route preview, ETA; dark/light modes and reduced motion.
- **Lists**: Infinite scroll or pagination, filter chips, sort controls, saved views.
- **Accessibility**: Full keyboard navigation, ARIA roles, sufficient contrast, screen reader labels for critical actions (e.g., “Start Pickup”).

## Landing & Public

### Landing Page
- **Hero Section**
  - Components: Headline, subheading, background illustration, address inputs (Pickup, Dropoff), package size selector, CTA buttons.
  - Buttons:
    - **Get Instant Quote**: Opens quote modal; if addresses present, pre‑calculates; else shows form errors.
    - **Book Delivery**: If authenticated sender → go to Create Delivery, else open Sign In/Up modal.
    - **Become a Courier**: Routes to Courier Onboarding start.
    - **Track Package**: Opens Track Package page.
  - Modals: Quote modal (price breakdown, ETA, vehicle suggestion, “Continue to Booking”).
- **How It Works**: 3–5 steps with icons (Request → Match → Pickup → Deliver → Rate). Each step card is clickable to learn more.
- **Trust & Safety**: ID verification badges, insurance blurb, ratings snippets.
- **Testimonials**: Carousel with sender quotes and star ratings.
- **FAQ Preview**: Accordion of top questions; “View all” to Help Center.
- **Footer**: Links (Legal, Help, Careers), locale switcher.

### Track Package (Public)
- Components: Tracking input, “Find my delivery” button, example format hint.
- Buttons:
  - **Find Delivery**: Validates tracking code; on success, shows anonymized tracker; on protected shipments, prompts to sign in.
- States: Not found (suggest check code), In transit (limited view), Delivered (proof photo masked), Requires Auth.

### Pricing & Fees (Public)
- Components: Pricing table by distance/weight/vehicle, surcharges (peak, insurance), FAQ.
- Buttons: **Calculate Estimate** (opens quote modal with advanced options).

### Help Center & FAQs (Public)
- Components: Search bar, categories (Senders, Couriers, Payments), article list.
- Buttons: **Contact Support** (opens form), **Report a Problem** (for logged‑in users prompts sign in).

## Authentication & Onboarding

### Sign Up / Sign In / 2FA / Reset Password
- Components: Email/Phone fields, password inputs with strength meter, social sign‑in, remember me, 2FA code input.
- Buttons:
  - **Continue** (primary): Validates and proceeds.
  - **Use Magic Link**: Sends email link; toast confirmation.
  - **Send Code Again**: 2FA resend with cooldown timer.
  - **Forgot Password**: Opens reset flow.
- Modals: Terms consent, privacy acknowledgement for phone auth.

### Sender Onboarding
- Components: Name, business toggle, default pickup address, address book import (CSV/Google), preferred payment setup.
- Buttons: **Save & Continue**, **Skip for Now** (with reminder toast).

### Courier Onboarding (KYC)
- Components: Identity verification (ID scan), selfie capture, background consent, vehicle details (type, plate), insurance upload, bank info.
- Buttons:
  - **Start Verification**, **Upload Documents**, **Link Bank**.
  - **Submit Application**: Locks edits pending review.
- States: Verification pending, rejected (with reasons), additional info requested.

## Sender App

### Sender Dashboard
- Components: KPI tiles (Active, Scheduled, Delivered), quick actions row, recent deliveries list, map of current couriers (optional), messages preview, notifications.
- Buttons:
  - **Book Delivery** (primary): Opens Create Delivery.
  - **Get Instant Quote**: Opens quote modal.
  - **Import Addresses**: Opens import modal.
  - **View All Deliveries**, **Open Messages**, **See Notifications**.

### Create Delivery (Multi‑Step Booking)
- Stepper across the top; save‑as‑draft support on each step.
- Steps & Components:
  1) Pickup & Dropoff
     - Address inputs with autocomplete, map pin picker, contact names/phones, access notes, elevator/stairs.
     - Buttons: **Use Current Location**, **Swap Addresses**, **Save & Continue**.
  2) Package Details
     - Size category or dimensions, weight, photos, special handling (fragile, perishable), declared value for insurance.
     - Buttons: **Add Photo**, **Calculate Size**, **Save & Continue**.
  3) Options
     - Signature required, leave at door, proof photo, insurance addon, tip preset (editable later), promo code field.
     - Buttons: **Apply Promo**, **Save & Continue**.
  4) Schedule
     - ASAP vs. scheduled, time window picker, pickup time SLA, courier lead time indicator.
     - Buttons: **Schedule Pickup**, **Save & Continue**.
  5) Courier Preferences
     - Vehicle type, min rating, favorites, exclude list.
     - Buttons: **Save & Continue**.
  6) Price & Payment
     - Fare breakdown (base, distance, weight, options, fees), taxes, insurance, tip; payment method selector; wallet balance.
     - Buttons: **Pay & Book** (primary), **Add Payment Method**, **Use Wallet**.
  7) Review
     - Summary cards; terms acknowledgment.
     - Buttons: **Confirm Booking** (opens confirmation modal), **Edit Step**.
- Modals:
  - Booking Confirmation: Shows tracking ID, ETA, “Share Tracking Link”, **View Delivery**.
  - Cancel Booking: Requires reason; fees warning if within SLA window.
- Error States: Invalid address, unsupported route/vehicle, payment declined (retry or change method).

### Live Tracking (Sender View)
- Components: Map with courier location, route, ETA; status timeline; courier card (photo, rating, vehicle), chat/call actions, delivery PIN/QR, proof photos after delivery.
- Buttons:
  - While waiting: **Cancel Delivery** (modal with fees), **Message Courier**, **Call Courier**.
  - At pickup: **Share Pickup PIN/QR**.
  - After delivered: **Tip Courier**, **Rate Delivery**, **Report Issue**.
- States: Searching for courier, courier assigned, arriving, picked up, en route, delivered, failed.

### My Deliveries (List & Detail)
- List Components: Tabs (All, Active, Scheduled, Delivered, Cancelled), filter chips (date, status, vehicle), search by address/tracking, export CSV.
- Row Actions: **View**, **Duplicate**, **Cancel** (if eligible), **Download Invoice**.
- Detail Components: Timeline with timestamps, address cards, package info, charges breakdown, receipts, proof assets, messages thread.
- Detail Buttons: **Tip**, **Reorder**, **Open Dispute**, **Print Receipt**.

### Address Book
- Components: Saved addresses with nicknames, contact details, default toggles, bulk import/export.
- Buttons: **Add Address**, **Import**, **Export**, **Set as Default**, **Delete** (destructive confirm).

### Wallet & Payments
- Components: Saved cards, bank accounts, wallet balance, transactions list, auto‑recharge toggle.
- Buttons: **Add Card**, **Add Bank**, **Set Default**, **Remove**, **Top Up**, **Withdraw** (if wallet supports payouts/refunds).

### Invoices & Billing
- Components: Invoice list, filters, tax details, invoice detail view with PDF.
- Buttons: **Download PDF**, **Send to Email**, **Add Tax Info**.

### Messages / Chat
- Components: Conversation list, active chat, attachments (photo), quick replies.
- Buttons: **Send**, **Attach Photo**, **Call**.

### Notifications Center
- Components: Unread filter, per‑type preferences, mark‑all‑read.
- Buttons: **Mark All as Read**, **Manage Preferences**.

### Support & Disputes
- Components: New ticket form (order selector), issue categories, attachments, SLA indicator, ticket thread.
- Buttons: **Open Ticket**, **Add Comment**, **Close Ticket**.

## Courier App

### Courier Dashboard
- Components: Availability toggle, today’s earnings, weekly summary, active delivery card, heatmap (peak pay), compliance reminders (documents expiring).
- Buttons: **Go Online/Offline**, **View Offers**, **View Earnings**, **Update Documents**.

### Delivery Feed / Offers
- Components: Offer cards with pickup/dropoff areas, distance, estimated time, payout, package size, special notes; countdown timer.
- Buttons: **Accept** (primary), **Decline** (secondary); **View Details**.
- States: Auto‑expire on countdown; cooldown after decline streak.

### Active Delivery Flow
- Components: Stepper and state card; map + navigation link; contact controls; scan/verify area.
- Buttons (state‑driven):
  - **Start Pickup** → sets status to “en route to pickup”.
  - **Arrived at Pickup** → notifies sender.
  - **Scan QR / Enter PIN** (pickup verification) → unlocks next step.
  - **Picked Up** → starts delivery leg; route updates.
  - **Start Delivery** → navigation to dropoff.
  - **Arrived at Dropoff**.
  - **Obtain Signature** or **Take Proof Photo** (based on options).
  - **Delivered** → completion modal; prompts for issues if any.
  - **Report Issue** → modal (recipient unavailable, address problem, damaged item) with evidence upload.
- Modals: Verification success/fail, issue reporting, cancellation (two‑party acknowledgments where needed).

### Map & Navigation
- Components: Map viewport, turn‑by‑turn deep link, traffic overlay, battery/data warnings.
- Buttons: **Open in Maps**, **Recenter**, **Toggle Traffic**.

### Earnings & Payouts
- Components: Balance, pending payouts, weekly breakdown, bonuses (peak, quests), transaction list, tax documents.
- Buttons: **Cash Out**, **Link Bank**, **View Statement**, **Download CSV**.

### Ratings & Reviews
- Components: Average rating, recent reviews, breakdown by star, quality metrics (on‑time %, handoff quality, communication).
- Buttons: **Appeal Review** (if policy allows), **View Guidelines**.

### Vehicle & Documents
- Components: Vehicle types, plate, insurance, license; document status chips; upload controls with OCR.
- Buttons: **Add Vehicle**, **Upload/Replace Document**, **Set Primary Vehicle**.

### Availability Schedule
- Components: Calendar with time blocks, recurring schedules, vacation mode.
- Buttons: **Add Time Block**, **Copy Week**, **Set Vacation**.

## Cross‑App

### Global Navigation
- Header (all apps): Logo, role switcher (Sender/Courier), quick search, notifications bell, messages, profile menu.
- Sidebar (dashboards): Sectioned nav with icons (Dashboard, Deliveries, Messages, Wallet/Earnings, Settings, Support).
- Footer: Links (Help, Legal, Careers), region/language selector.
- Buttons: **Switch Role** (persists choice), **New Delivery** (sender‑only), **Go Online** (courier‑only).

### Settings
- Profile: Name, photo, phone, email.
- Notifications: Channel toggles (push, SMS, email), per‑event preferences.
- Security: Password change, 2FA, sessions list, device approvals.
- Privacy: Data export, delete account, marketing consents.
- Buttons: **Save Changes**, **Enable 2FA**, **Log Out**, **Delete Account** (destructive confirm).

### Legal Pages
- Terms of Service, Privacy Policy, Insurance & Claims, Cookie Policy.
- Buttons: **Download PDF**, **Print**.

### Error & Empty States
- 404: Friendly message, **Go Home**.
- 500: Retry, **Contact Support**.
- Offline: Local cache status, **Retry**.
- Empty Lists: Guidance copy and **Create/Start** CTAs.

## Component & Action Glossary (Buttons & Modals)
- Primary CTAs (global): **Book Delivery**, **Get Instant Quote**, **Become a Courier**, **Track Package**.
- Sender booking actions: **Use Current Location**, **Swap Addresses**, **Apply Promo**, **Pay & Book**, **Confirm Booking**, **Cancel Delivery**.
- Sender post‑delivery: **Tip Courier**, **Rate Delivery**, **Report Issue**, **Reorder**.
- Courier lifecycle: **Start Pickup**, **Arrived at Pickup**, **Scan QR / Enter PIN**, **Picked Up**, **Start Delivery**, **Arrived at Dropoff**, **Obtain Signature/Photo**, **Delivered**, **Report Issue**.
- Account & settings: **Add Card/Bank**, **Cash Out**, **Enable 2FA**, **Delete Account**.
- Common modals: Confirmation, Cancellation (with reasons), Verification (QR/PIN), Tip & Rate, Report Issue, Payment Failed (retry/change method).

## Notes on Compliance & Safety
- Identity & vehicle verification required for couriers prior to going online.
- In‑app messaging is monitored for safety; phone masking for calls.
- Location data permission prompts with rationale and settings link.
- Data retention and export available under Privacy settings.

## Future Enhancements (Optional)
- Multi‑stop deliveries for senders.
- Group shipments (batching) with savings.
- Shared live tracking for group chats.
- In‑app promotions with quest/bonus for couriers.

