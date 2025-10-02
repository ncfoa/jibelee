## P2P Delivery Platform – UI Reference Guide

This document explains every page and interactive element (buttons, inputs, selects, tabs, tables, dialogs, toasts) across Customer, Traveler, and Admin interfaces. It maps UI elements to the underlying flows and APIs to clarify behavior, validations, and states.

### Global UI Elements
- **Top Navigation Bar**
  - **Logo/Home button**: Navigates to role-aware home (Customer: Delivery Requests; Traveler: Trips; Admin: Dashboard).
  - **Search**: Contextual search; supports trips, travelers, requests depending on page. Debounced input with suggestions.
  - **Notifications (bell)**: Opens panel with unread notifications; supports click to navigate, mark-as-read, and filters (All/Transactional/Marketing/Operational).
  - **Messages/Inbox**: Opens conversation drawer for offers and delivery-related messages.
  - **Profile menu (avatar)**: Links to `Profile`, `Settings`, `Verification`, `Help`, `Logout`.
- **Footer**
  - **Links**: Terms, Privacy, Support, Status, API Docs. All open in new tab.
- **System Toasts**
  - Success, Info, Warning, Error with auto-dismiss and manual close.
- **Modals/Dialogs**
  - Confirmations (delete, cancel, accept, payout), Form dialogs (create/edit quick actions), Info dialogs (security, QR guidance).

---

## Design Language – Uber x Amazon, powered by Adobe Spectrum

- **Visual identity**
  - High-contrast, legible, performance-first like Uber; information-dense and commerce-clear like Amazon; refined surfaces and accessible tokens from Adobe Spectrum.
  - **Typography**: Spectrum type scale (Source Sans/Adobe Clean equivalent). Headings bold, body regular; large numeric for prices/ETAs.
  - **Color**: Spectrum semantic tokens (positive, notice, negative, info) with a restrained accent (primary CTA). Dark and light themes supported.
  - **Elevation**: Subtle shadows for interactive cards, dividers for section hierarchy. Avoid heavy borders; use surface contrast.
- **Layout**
  - 12-column grid, 1280–1440px content max width on desktop. 16/24px spacing step system. Sticky topbar and context footers.
  - Left filter rail pattern for browse pages (Amazon), map-first hero for logistics moments (Uber).
- **Controls**
  - Pill-shaped search and primary CTA in hero areas; standard Spectrum shapes elsewhere. Large tap targets (min 44px).
  - Clear primary/secondary/tertiary button hierarchy; destructive outlined in red semantic.
- **Motion**
  - 150–200ms ease-out for affordances; 250–300ms for modal/dialog. Use micro-interactions for confirmations, no blocking loaders.
- **Iconography**
  - Simple, geometric icon set; consistent stroke weight. Use StatusLight and inline icons for feedback.
- **Accessibility**
  - WCAG 2.1 AA, focus rings, high-contrast mode, full keyboard flows, screen-reader labels everywhere.

### Spectrum Component Mapping

| Purpose | Spectrum Component |
|---|---|
| Primary CTA | Button (variant: emphasized) |
| Secondary action | Button (default) |
| Destructive | Button (negative) |
| Text input | TextField |
| Search with suggestions | ComboBox |
| Select | Picker |
| Multi-select chips | TagGroup |
| Tabs | Tabs |
| Date/Time | DatePicker, TimeField, DateRangePicker |
| Table/List | Table, ListView |
| Modal | Dialog |
| Toast/Banner | Toast, InlineAlert, StatusLight |
| Stepper | Stepper |
| Pagination | Pagination |

---

## Landing (First Page) – Public

- **Hero section (primary CTA)**
  - **Drop-off address input (prominent)**: Typeahead with geocoding, supports paste and recent addresses. Required.
  - **Pickup input (optional)**: Defaults to current location; includes `Use my location` button with permission prompt and fallback.
  - **When picker**: Date/time with presets (As soon as possible, Today, Tomorrow), timezone-aware.
  - **Item weight select**: Common presets + custom entry (kg/lb switch).
  - **Start button**: Runs instant quote + match preview; scrolls to Results section. Keyboard Enter triggers Start.
- **Microcopy/tagline**: “Smart, secure, real people deliveries along existing routes.”
- **Secondary CTAs**
  - **Send a delivery**: Deep-links to Create Delivery Request wizard prefilled from hero inputs.
  - **I’m traveling**: Deep-links to Create Trip wizard with origin/destination autofilled (if provided).
- **Results preview (below hero)**
  - Shows top traveler matches on map + list (limited) based on hero input; `View all` button navigates to full results/browse.
- **How it works**
  - 1) Post details → 2) Get matched → 3) QR-verified handoff → 4) Escrow-protected payout. Each step clickable to learn more.
- **Trust & proof**
  - Real-time counters (deliveries completed, on-time rate), verification badges explanation, platform safety highlights.
- **Trending routes carousel**
  - Chips (e.g., NYC → Boston); clicking fills hero inputs.
- **Testimonials strip**
  - Short quotes with ratings; `See more` opens modal.
- **SEO footer content**
  - City/route links; minimal to keep page fast.

### Landing Page Behavior
- **Typeahead**: Debounced geocoding, keyboard navigation, clear button, recent history chips.
- **Validation**: Requires drop-off before Start; highlights missing fields with inline hints.
- **Performance**: Prefetch search assets after first keystroke; lazy-load map.
- **Accessibility**: Proper labels, describedby for help text, skip to results link.

### Responsiveness
- **Mobile**: Sticky `Start` button, inputs in stacked cards; hero map hidden until results to minimize CLS.
- **Desktop**: Side-by-side inputs with large Start button; results preview to the right of hero.

### Style specifics
- **Hero**: Full-bleed dark map with soft gradient overlay; center-aligned inputs in a high-contrast card.
- **Inputs**: Pill-shaped `Drop-off` primary, compact `Pickup`, discrete `When` and `Weight`; icons inside fields.
- **CTA**: Large emphasized `Start` button (Spectrum emphasized) with progress affordance on submit.
- **Trust row**: Compact badges/icons aligned like Amazon’s proof bar.

---

## Role-Aware Home (Logged In)

### Customer Home (Logged In)
- **Hero quick quote**: Prefills with default pickup (home address) and last used drop-off; `Get matches` button.
- **Primary actions**: `Create request`, `Track delivery`, `Browse travelers`.
- **My activity**: Cards for Open requests, Offers pending, Active deliveries (with quick `View QR`).
- **Recommendations**: Suggested travelers/routes based on history.

### Traveler Home (Logged In)
- **Hero quick publish**: Origin/Destination inputs with `Create trip` CTA; `Monetize your trip` microcopy.
- **Primary actions**: `Create trip`, `Incoming requests`, `My templates`.
- **Capacity & schedule**: Upcoming trips list with utilization mini-bars.
- **Recommendations**: Popular routes, demand heatmap snippet.

### Hybrid Users
- **Role toggle**: Customer | Traveler tabs; persists preference; surfaces relevant KPIs and actions per tab.

---

## Navigation & Flow Patterns
- **Persistent topbar** with global search and quick actions.
- **Context tabs** within sections (e.g., Offers, Timeline, Documents).
- **Breadcrumbs** on admin and deep detail pages.
- **Sticky footers** for long forms with `Cancel` and `Save/Continue`.
- **Forward links** at end of flows (e.g., after creating a request → `Browse traveler matches`).
- **Back to list** buttons consistently placed top-left in details.
- **Inline steppers** for wizards with clear step names and saved progress.

---

## First-Run Experience (New Users)
- **Onboarding checklist** (progress banner): Add address, Verify email/phone, Complete profile, ID verification, Set notifications.
- **Contextual nudges**: Inline tips near actions (e.g., “Verify ID to raise limits”).
- **Skippable tour**: 3–5 step guided highlights with `Next`, `Skip`, `Done`.

---

## Sitemap

- **Public**
  - Landing (First Page)
  - Login, Register, Verify Email, Forgot/Reset Password
  - Legal: Terms, Privacy; System Status
- **Shared (Authenticated)**
  - Role-aware Home/Dashboard
  - Profile, Verification, Settings, Privacy & Location
  - Notifications, Messaging/Inbox
  - Wallet & Payments (Customer), Payouts (Traveler)
  - Help/Support
- **Customer**
  - Delivery Requests List
  - Create Delivery Request (wizard)
  - Request Details (Offers, Timeline, Documents)
  - Offer Comparison
  - Payment/Checkout (Escrow)
  - Delivery Tracking (Map, QR Codes, Timeline)
  - Reviews/Rating
- **Traveler**
  - Trips List
  - Create Trip (wizard)
  - Trip Details (Capacity, Weather, Offers, Templates, Analytics)
  - Live Trip (Tracking, QR Scan)
  - Trip Templates (My, Public, Popular)
  - Payouts
  - Traveler Analytics
- **Location & Routing**
  - Live Tracking
  - Geofences
  - Route Optimization
- **QR Verification**
  - QR Codes (Generate/Display)
  - QR Scan
- **Admin**
  - Admin Login
  - Dashboard
  - Users, Verifications, Disputes
  - Financials
  - System Config
  - Analytics
  - Backups & Maintenance
- **Error & Maintenance**
  - 403/404/500 pages; Maintenance window page

---

## Authentication & Onboarding

### Sign Up Page
- **Email input**: Validates format and uniqueness. Inline error on blur.
- **Password input**: Strength meter; requirements tooltip; show/hide toggle.
- **Referral code input (optional)**: Validates format.
- **User type select**: `Customer`, `Traveler`, `Both`.
- **Consent checkboxes**: Terms and Privacy (required).
- **Register button**: Submits; disabled until valid. On success, routes to email verification.

### Email Verification Page
- **Verification code input**: 6-digit segmented input; paste support.
- **Verify button**: Validates and continues to Profile Setup.
- **Resend code button**: Rate-limited; shows countdown.

### Login Page
- **Email input**, **Password input**: With remember me.
- **Login button**: On success, may prompt 2FA.
- **Forgot password link**: Routes to password reset flow.
- **Social login buttons**: Disabled if not configured.

### Two-Factor Authentication Page
- **TOTP code input**: 6-digit segmented input.
- **Verify button**: Completes login; supports backup codes.
- **Use backup code link**: Switches input mode.

### Forgot/Reset Password Pages
- **Email input** (request): Sends reset email.
- **New password inputs** (reset): New + confirm; strength meter; submit to update and revoke sessions.

---

## Profile, Verification, and Settings

### Profile Page
- **Profile photo uploader**: Drag-and-drop with crop; progress indicator.
- **Personal info form**: First/last name, phone (with SMS verify), bio.
- **Address management**: List with `Add address` button opens form with address autocomplete, map preview, default toggle.
- **Preferences**: Notification toggles (Email/SMS/Push/In-app), language select, quiet hours.
- **Save changes button**: Sticky footer; disabled until dirty/valid.

### Identity Verification Page
- **Verification level indicator**: Badges (Unverified → Email → Phone → ID → Fully Verified).
- **Document type select**: ID card, Passport, Driver’s license.
- **Front/back upload inputs**: With live validation and clarity tips; capture via camera on mobile.
- **Selfie capture**: Liveness guidance; retake option.
- **Submit for review button**: Locks edits; shows `In review` banner.
- **Status timeline**: Submitted → AI review → Manual review (if needed) → Approved/Rejected with notes.

### Privacy & Location Settings Page
- **Tracking level radio group**: Precise / Reduced / Off.
- **Sharing toggles**: Customers, Platform, Emergency Contacts, Third Parties.
- **Data retention select**: Days; `Delete after delivery` toggle; `Anonymize after X hours` input.
- **Save button**.

---

## Customer Experience

### Customer Home – Delivery Requests List
- **Create request button**: Primary CTA; opens multi-step wizard.
- **Filters panel**: Item category select, price range slider, time window picker, traveler rating min, route proximity.
- **Search bar**: Keyword (route, item, city).
- **Requests table/cards**: Columns: Status, Item, From → To, Window, Max price, Offers count, Actions.
  - **Actions menu**: View, Edit, Duplicate, Cancel, Delete.
- **Pagination** with page size select.

### Create Delivery Request Wizard (multi-step)
1. **Item Details**
   - Inputs: Title, Category select, Description textarea.
   - Dimensions group: Weight, Length, Width, Height; units select.
   - Special handling checkboxes: Fragile, Perishable, Requires signature, Insurance.
   - Next button.
2. **Pickup & Delivery**
   - Address autocompletes with maps; Contact name/phone; Instructions textarea.
   - Time window pickers (from/to) with timezone awareness; Flexibility toggle.
   - Next button.
3. **Pricing & Preferences**
   - Max price input; Auto-accept threshold input.
   - Preferred travelers multiselect; Blocked travelers multiselect.
   - Minimum traveler rating slider.
   - Next button.
4. **Review & Submit**
   - Summary card with editable sections.
   - Submit button: Creates request; shows success with link to Offers.

### Request Details Page
- **Header**: Status badge; Edit/Duplicate/Cancel buttons.
- **Offers tab**: List of offers with sort (price, ETA, rating).
  - Offer card buttons: `View traveler`, `Compare`, `Accept`, `Counteroffer`, `Message`.
- **Timeline tab**: Request lifecycle events.
- **Documents tab**: Upload attachments, photos; viewer.
- **Actions**: `Accept offer` opens confirmation + payment modal.

### Offer Comparison Modal
- **Selectable rows**: Two or more offers.
- **Comparison table**: Price, ETA, Traveler rating, Route match, Response time, Terms.
- **Accept button**: Proceeds to payment.

### Payment Modal (Escrow)
- **Amount breakdown**: Base, fees, insurance, total.
- **Payment method select**: Add card, existing methods; 3DS flow if required.
- **Confirm & Pay button**: Creates payment intent; on success redirects to Delivery Tracking.

### Delivery Tracking Page
- **Map panel**: Live location; route polyline; ETA; traffic indicator.
- **Status timeline**: accepted → pickup_ready → picked_up → in_transit → delivered → completed → rated.
- **QR Codes section**: `View pickup QR`, `View delivery QR`; `Share QR` link.
- **Contact actions**: Message traveler, Call (if allowed).
- **Issue/Dispute button**: Opens dispute form modal.

### Rate & Review Dialog
- **Star rating** (1–5), **Tags** (On time, Careful, Friendly), **Comment textarea**.
- **Submit button**: Posts review; updates traveler profile.

---

## Traveler Experience

### Traveler Home – Trips List
- **Create trip button**: Opens trip creation wizard.
- **Filters**: Route (origin/destination), time window, capacity availability, transport type.
- **Trips table/cards**: Status, From → To, Departure/Arrival, Capacity, Pricing, Actions.
  - **Actions**: View, Edit, Duplicate, Start, Cancel, Share, Export.

### Create Trip Wizard (multi-step)
1. **Basics**: Title, Transport type select (Flight/Car/Train/Bus), Description.
2. **Route & Schedule**: Origin/Destination autocompletes with map; Departure/Arrival datetime pickers.
3. **Capacity & Pricing**: Weight/Volume/Items inputs; Base price; per-kg, per-km; Express/Fragile multipliers; Auto-accept threshold.
4. **Preferences**: Accepted categories, Max item value, Restrictions, Visibility select (Public/Private).
5. **Review & Publish**: Summary; `Publish trip` button.

### Trip Details Page
- **Header**: Status badge with `Start`, `Complete`, `Cancel` buttons.
- **Capacity panel**: Available/Reserved/Allocated; `Reserve capacity` button; `Release` button.
- **Weather panel**: Current and alerts; `Refresh weather` button.
- **Offers/Requests tab**: Incoming delivery requests with `Propose offer`, `Accept`, `Message`.
- **Templates tab**: `Save as template`, `Create from template` button.
- **Analytics tab**: Route performance, utilization, recommendations.

### Offer Proposal Dialog
- **Price input**, **ETA inputs**, **Message textarea**.
- **Submit offer button**: Creates offer; shows success toast.

### Trip Templates Page
- **My templates list** with actions: Use, Edit, Delete.
- **Public templates** and **Popular templates** tabs.
- **Create template button**.

### Traveler Live Trip Page
- **Map with live tracking**: Start/Stop tracking buttons.
- **QR scan actions**: `Scan pickup QR`, `Scan delivery QR` (opens camera permission modal).
- **Geofence indicators**: Entry/exit events; toasts.

---

## Shared Components

### Messaging/Inbox Drawer
- **Thread list** with unread badges; search.
- **Composer**: Text input, attachments, quick templates; `Send` button.
- **Offer context** chip linking to offer/request/trip.

### Notifications Panel
- **Tabs**: All, Transactional, Marketing, Operational.
- **Actions**: Mark all as read, Mute category, Go to settings.

### File Uploader
- Drag-and-drop; progress; retry on failure; virus scan indicator.

### Map Autocomplete & Picker
- Address input with suggestions; `Use current location` button; mini-map preview.

### Date/Time Pickers
- Timezone-aware; presets (Today, Tomorrow, Next week).

### Tables
- Sortable headers; column visibility; CSV export; server-side pagination.

---

## Payments & Payouts

### Wallet & Payments Page (Customer)
- **Payment methods**: List, `Add card` button, `Set default`, `Remove`.
- **Transactions table**: Status, Amount, Delivery, Date, Receipt button.

### Payouts Page (Traveler)
- **Account setup wizard**: Legal name, DOB, Address, Bank details; `Verify identity` step.
- **Payout schedule select**: Automatic (weekly/monthly) or manual.
- **Payouts table**: Status, Amount, Date, Reference, `Download tax document`.

---

## QR Code Verification

### QR Codes Page/Modal
- **Generate/Display QR buttons**: Pickup and Delivery.
- **Security level select**: Standard / High / Maximum.
- **Bind to location toggle**; **Expiration select**.
- **Show backup code** button.

### QR Scan Page
- **Camera viewport** with framing guide.
- **Torch toggle**, **Switch camera**.
- **Scan result panel**: Payload summary, Participant identities, Location match indicator; `Confirm` button.

---

## Location & Tracking

### Live Tracking Page
- **Start tracking button**: Begins session for selected delivery.
- **Stop tracking button**: Ends session; shows summary.
- **Battery/network indicators**.
- **Geofences panel**: List active geofences; `Create geofence` button.

### Route Optimization Dialog
- **Origin/Destination inputs**; Waypoints list with types; Preferences (avoid tolls/highways, optimize by time/distance); Constraints.
- **Optimize route button**: Shows alternatives and metrics; `Apply route` button.

---

## Admin Console

### Admin Login Page
- **Email**, **Password** inputs; **Login** button; MFA if enabled.

### Admin Dashboard
- **KPIs cards**: Users, Deliveries, Revenue, Success rate, Error rate.
- **System health widget**: Service statuses; `View details` button.
- **Live metrics chart**: Throughput, latency; real-time socket updates.
- **Alerts panel**: Dismiss, Acknowledge, Create incident.

### Admin Users Page
- **User search bar**; Filters (role, status, verification level).
- **Users table**: Columns: ID, Name, Email, Role, Status, Created, Actions.
  - **Actions menu**: View profile, Suspend/Activate, Reset password, Export data, Delete.
- **Bulk actions**: Select rows → Suspend, Export, Message.

### Admin Verifications Page
- **Pending queue**: Card/list view with AI confidence; `Approve`, `Reject`, `Request more info` buttons.
- **Details drawer**: Documents viewer, selfie match, metadata, audit log.

### Admin Disputes Page
- **Create dispute button** (manual cases), Filters (status, reason).
- **Disputes table**: Case ID, Participants, Delivery, Status, Opened, SLA, Actions.
- **Dispute details**: Messages thread, Evidence gallery, Decisions, Refund controls.

### Admin Financials Page
- **Revenue charts**; **Payouts table**; **Refunds table**; **Chargebacks** with evidence status.
- **Actions**: Approve payout, Issue refund, Export report.

### Admin System Config Page
- **Feature flags toggles**, **Pricing factors sliders**, **Business rules editor**.
- **Save config button**; **Publish changes** with confirmation.

### Admin Analytics Page
- **Dashboards**: User growth, Delivery success, Average times, Satisfaction.
- **Custom reports builder**: Metric selects, date ranges; `Generate` and `Export`.

### Admin Backups & Maintenance Page
- **Backups list**: Create backup, Restore, Download.
- **Maintenance actions**: Run cleanup, Reindex, Health checks.

---

## Accessibility & Internationalization
- **Keyboard navigation**: Focus outlines, skip links, logical tab order.
- **ARIA roles/labels** across interactive components.
- **Color contrast** meets WCAG AA; theme supports High Contrast mode.
- **Localization**: Language select; date/time/number formats; RTL support.

---

## Error States & Empty States
- **Form validation**: Inline messages on blur and on submit; summary banner on top.
- **Empty states**: Helpful illustration, description, and primary CTA.
- **Loading states**: Skeletons for lists and cards; spinners for actions.
- **Failure states**: Retry buttons; diagnostic links on admin-only pages.

---

## Security & Privacy UI
- **Security alerts**: New login, password change, 2FA events shown in notifications.
- **Session management**: Active sessions list with `Revoke` buttons.
- **Data controls**: `Export my data`, `Delete my account` with multi-step confirmations.

---

## Glossary of Buttons and Actions (Alphabetical)
- **Accept**: Confirm offer or terms; triggers creation or state transition.
- **Add**: Create new resource (address, method, template, geofence).
- **Approve**: Admin action to approve verification or payout.
- **Cancel**: Abort operation or revert status to cancelled.
- **Complete**: Mark trip or delivery as completed.
- **Confirm & Pay**: Finalize payment and escrow fund capture.
- **Create**: Submit new entity (request, trip, template, geofence).
- **Delete**: Permanently remove; requires confirmation.
- **Duplicate**: Clone with editable fields prefilled.
- **Edit**: Switch to editable mode; save/cancel applies.
- **Export**: Download CSV/JSON or report.
- **Generate**: Create artifacts (QR, reports, backups).
- **Mark as Read**: Notifications; affects unread count.
- **Message**: Opens composer with context.
- **Optimize**: Runs route optimization and shows alternatives.
- **Publish**: Make trip/template visible.
- **Reject**: Admin declines verification/dispute resolution.
- **Release**: Free reserved capacity or escrow (admin).
- **Resend**: Send code/email again with cooldown.
- **Reserve**: Hold capacity for request.
- **Scan**: Open camera to scan QR; requires permissions.
- **Share**: Copy deep link/QR to clipboard; show sharing options.
- **Start**: Begin trip or tracking session.
- **Suspend/Activate**: Toggle user account status (admin).
- **Verify**: Validate code or identity step.

---

## Notes
- All destructive actions require confirmation dialogs.
- Long-running operations display progress and remain cancelable when safe.
- Background updates use toasts and subtle in-place refresh, avoiding jarring reloads.
