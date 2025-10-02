## P2P Marketplace UI Guide

This document defines the end-to-end UI for a peer-to-peer marketplace with Amazon-like browsing and checkout, plus support for booking/rental/services. It explains each page, core components, every critical button, and the modals or flows triggered by those buttons.

### Global UI Primitives
- **Header**: Logo (Home), Category dropdown, Search bar, Location selector, Language/Currency, Sell button, Inbox, Orders, Saved, Cart, Account menu.
- **Footer**: Category links, How it works, Trust & Safety, Help Center, About, Social links, Legal.
- **Search**: Debounced suggestions (recent searches, categories, listings, sellers). Enter triggers `/search?q=...`.
- **Modals**: Centered responsive dialogs with ESC to close, outside-click closes if not destructive. All destructive actions require confirmation.
- **Toasts**: Success, warning, error; appear bottom-right; auto-dismiss in 5s.
- **Loaders/Empty states**: Skeletons for cards and detail pages; empty states with helpful CTAs.
- **Badges**: New, Trending, Verified, Top Seller, Instant Book, Sale %, Free Shipping.
- **Auth gates**: Actions requiring identity show auth modal if unauthenticated.

### Primary Navigation (Header)
- **Logo**: Navigates to `/`.
- **Category** (button): Opens mega-menu with top categories and featured sub-categories.
  - Click category ⇒ goes to `/search?category=...`.
- **Search bar**: Typeahead results; Enter or Search icon ⇒ `/search?q=...`.
- **Location** (button): Opens modal to set country/region and radius; saves preference.
- **Language/Currency** (button): Opens modal; persists selection.
- **Sell** (primary button): If unauthenticated ⇒ Auth modal. If authenticated but not onboarded ⇒ Seller onboarding flow. Else ⇒ `/sell`.
- **Inbox** (icon): `/inbox`. Badge shows unread count.
- **Orders** (icon): `/dashboard/buyer/orders`.
- **Saved** (icon): `/dashboard/buyer/saved`.
- **Cart** (icon): `/cart`. Badge shows item count.
- **Account** (avatar/button): Menu with Profile, Dashboard, Settings, Sign out.

### Landing Page (`/`)
- **Hero**: Large search field with category and location filters.
  - Buttons: Search (submits); Start Selling (⇒ Sell onboarding/`/sell`).
- **Category carousel**: Click ⇒ `/search?category=...`.
- **Featured/Trending grid**: Card click ⇒ Listing detail.
- **How it works**: Steps (Browse → Book/Buy → Exchange → Review). CTA buttons to Explore and Start Selling.
- **Trust & Safety**: Verification, Escrow, Reviews; Learn more ⇒ `/trust`.
- **Footer CTAs**: Help Center, About, Careers.

### Authentication
- **Sign in** (link/button): Opens modal with Email/Password + OAuth.
  - Buttons: Continue (validates), Continue with Google/Apple, Forgot password (opens reset modal), Create account (switches to Sign up).
- **Sign up**: Name, Email, Password; optional phone; accepts Terms.
  - Buttons: Create account; OAuth; Already have an account (switch to Sign in).
- **Email verification**: After sign up, shows Verify banner; Resend email (toast on success).

### Search Results (`/search`)
- **Header**: Query chips; editable search bar.
- **Filters panel** (toggle button): Category, Price range, Condition, Listing type (Buy, Rent, Service), Instant book, Location distance, Delivery options, Ratings, Seller status.
  - Buttons: Apply (closes panel, updates results), Reset (clears filters).
- **Sort** (select): Relevance, Price, Newest, Rating.
- **View toggle**: Grid/List; Map toggle (opens split map view).
- **Result cards**: Click ⇒ Listing detail. Buttons on card: Save (toggles), Share (opens share sheet), Quick View (opens mini detail modal).
- **Pagination/Infinite scroll**: Load more button; autos as viewport nears end.

### Listing Detail (`/listing/:id`)
- **Gallery**: Image carousel with zoom; Video support.
- **Title and badges**: Category, Verified, Instant Book.
- **Pricing**: Base price; if rental/service, shows per-day/per-hour; shows fees breakdown on hover.
- **Seller card**: Avatar, rating, response rate, location; View store (⇒ Seller profile); Contact seller (opens message modal).
- **Variants/Options** (if goods): Size/Color selectors.
- **Quantity** (goods): Stepper.
- **Date/Time/Duration** (rentals/services): Availability calendar; duration picker; time slots.
- **Delivery/Shipping**: Estimator; pickup vs delivery.
- **Policies**: Cancellation, returns, damage deposit.
- **Buttons**:
  - **Buy Now** (goods): Opens Checkout (if address/payment on file, can quick confirm). If unauthenticated ⇒ Auth modal.
  - **Add to Cart** (goods): Adds to cart; toast confirmation; offers View cart.
  - **Request to Book** (rentals/services): Opens Booking modal to select dates/times, participants, add message, and submit request. If listing supports Instant Book, button label shows **Book Now** and charges immediately with escrow.
  - **Contact Seller**: Opens message composer modal with listing context.
  - **Save**: Toggles favorite; updates count.
  - **Share**: Opens share sheet; copies link.
  - **Report**: Opens report modal with reason picker; submits to Trust & Safety.
  - **Start** (for service with online session): Appears after booking confirmed, within booking details; launches session join flow.

#### Booking Modal (rentals/services)
- Steps: Select dates/times → Add details (notes, add-ons) → Review price → Confirm.
- Buttons: Continue, Back, Confirm Booking. If Request-based, shows Submit Request; if Instant Book, shows Pay and Book.
- On confirm: Shows success state, routes to Booking details. Sends message to seller.

### Cart (`/cart`) – Goods
- Groups items by seller; shows shipping options and estimated tax.
- Buttons per item: Quantity stepper, Save for later, Remove, Move to another list.
- Cart-level: Apply promo code, Estimate shipping, Proceed to Checkout, Continue shopping.
- Inline error handling for stock changes and price updates.

### Checkout (`/checkout`) – Goods and Instant Book
- Steps: Address → Delivery → Payment → Review.
- Buttons: Continue, Back, Place order. For rentals/services Instant Book, labeling: Pay and Book.
- Save as default address/payment toggles.
- On success: Order confirmation page with next steps and contact seller.

### Booking/Request Flow – Rentals/Services (Non-instant)
- After Request to Book: Shows Pending status in Buyer Dashboard and in thread with seller.
- Seller can Accept, Counter, or Decline from Seller Dashboard or Inbox quick actions.
- Upon Accept: Buyer receives Pay to Confirm button in thread and booking details page; escrow captured on pay.

### Messaging/Inbox (`/inbox`)
- Thread list with filters (All, Unread, Orders, Bookings, Disputes).
- Thread view: Messages, system updates (order accepted, booking times), attachments, listing context.
- Composer: Text, emoji, file upload, quick templates (Shipping ETA, Thanks, Price offer).
- Buttons: Send, Attach, Create offer (opens offer modal), Mark as resolved, Escalate (opens dispute modal).

### Buyer Dashboard (`/dashboard/buyer`)
- **Overview**: Recent orders/bookings, messages, saved items.
- **Orders**: List with statuses; actions: Track, Contact seller, Return/Request refund (opens return modal), Leave review.
- **Bookings**: Calendar and list view; actions: View details, Modify request (if allowed), Cancel (opens confirm modal), Start (if online service and time reached).
- **Saved**: All favorites; actions: Move to cart (goods), Open listing.
- **Messages**: Inbox shortcut.
- **Addresses**: Add/edit/delete; set default.
- **Payments**: Add card, remove, set default.
- **Identity**: Verify (KYC) to unlock features; opens verification flow modal/page.
- **Settings**: Notifications, Privacy, Connected apps.

### Seller Onboarding (`/sell`)
- Stepper: Account type → Identity (KYC) → Payout method → Storefront → First listing.
- Buttons: Continue, Back, Save and exit. On completion, routes to Seller Dashboard.

### Listing Creator Wizard (`/sell/listings/new`)
- Steps:
  1) Listing type (Goods, Rental, Service)
  2) Title & Description
  3) Category & Attributes
  4) Media (photos/videos) uploader with drag-and-drop
  5) Pricing (base price, discounts; for rentals/services: per-period and deposit)
  6) Inventory & Availability (stock; calendar/time slots for rental/service)
  7) Delivery (shipping templates, pickup options; for services: location/virtual)
  8) Policies (cancellation, returns)
  9) Add-ons (optional upsells)
  10) SEO & Preview
- Buttons: Next, Back, Save draft, Preview, Publish.
- Validation highlights missing fields; Publish disabled until required fields met.

### Seller Dashboard (`/dashboard/seller`)
- **Home**: KPIs (views, conversion, revenue), quick actions (Create listing, View orders, Payouts).
- **Listings**: Table and cards; actions: Edit, Duplicate, Pause, Delete, Promote. Bulk actions with checkboxes.
- **Orders** (goods): Status pipeline; actions: Confirm, Print label, Mark shipped, Issue refund.
- **Requests/Bookings**: Calendar with pending/accepted; actions: Accept, Decline, Counter, Message, Reschedule.
- **Calendar** (rentals/services): Drag to block/allow time; sync external calendars.
- **Messages**: Inbox with seller templates and quick replies.
- **Payouts**: Balance, upcoming, history; actions: Withdraw (opens payout modal), Connect/Manage bank.
- **Analytics**: Traffic, conversion by source, top listings, heatmaps.
- **Reviews**: View, respond; report abusive reviews.
- **Disputes**: Active cases; actions: Provide evidence, Refund/Partial refund, Escalate.
- **Settings**: Storefront profile, Policies defaults, Tax, Shipping templates, Team members.

### Reviews & Ratings
- **Leave a review**: After fulfillment; 1–5 stars, text, photos/videos; private feedback to platform; submit.
- **Report review**: Opens report modal; sends to moderation.
- **Seller response**: Sellers can publicly reply to reviews.

### Notifications
- **Types**: In-app, email, SMS, push.
- **Preferences**: Buyer and seller configurable; per-event toggles.
- **Bell icon**: Opens notifications panel; items link to relevant pages; Mark all as read button.

### Trust & Safety
- **Verification**: Prompts for KYC when required; Verified badge on profile.
- **Escrow**: Goods – captured on checkout; Rentals/Services – captured on confirm; released per policy.
- **Insurance/Deposits**: For rentals; collected and refunded per policy.
- **Report user/listing**: Modal from profiles and listings.

### Help Center (`/help`)
- Search help articles, categories, contact options (chat, email). Start chat opens support chat widget.

### Seller/Storefront Profile (`/store/:id`)
- Store banner, description, ratings, listings grid, contact button (opens message modal), Follow store (saves seller).

### Account Settings (`/settings`)
- Profile, Security (2FA), Privacy, Connected apps, Data export, Delete account (destructive confirm modal).

### Admin (optional, if enabled)
- User management, Listings moderation, Disputes, Payouts oversight, Feature flags, CMS.

---

## Button & Modal Reference (What Happens When You Click…)

- **Search** (Landing/Search bar): Navigates to `/search?q=...` with current filters. Opens suggestions while typing.
- **Category item** (Header mega-menu): Navigates to `/search?category=...`.
- **Location selector**: Opens location modal → Save updates user context and refreshes search results.
- **Sell**: Auth modal if not signed in → Seller onboarding if not onboarded → `/sell` or `/sell/listings/new` if onboarded.
- **Sign in / Sign up**: Opens auth modal; successful auth closes modal and retries intended action.
- **Save (heart)** on card or detail: Toggles saved state; toast confirms.
- **Share**: Opens share sheet (copy link, social, embed where applicable).
- **Report**: Opens report modal; submit disables duplicates for 24h.
- **Buy Now** (goods): If address/payment on file and 1-click enabled → shows confirmation modal; else navigates to `/checkout`.
- **Add to Cart** (goods): Adds item with selected variant/quantity; toast + View cart button (navigates to `/cart`).
- **Request to Book** (rental/service): Opens Booking modal with calendar/time slots → Confirm submits request; success routes to booking detail and pings seller.
- **Book Now** (Instant Book): Booking modal condensed Review step → Pay & Book; success screen + message thread created.
- **Contact Seller**: Opens message composer modal prefilled with listing title; Send creates/continues thread.
- **Start** (service session): Becomes active at scheduled time; opens session join or third-party URL in new tab.
- **Apply filters**: Closes filter panel; updates results and query chips.
- **Reset filters**: Clears all filters to defaults; refreshes results.
- **Sort**: Re-queries with new sort; maintains filters.
- **Map toggle**: Opens map pane; clicking a pin focuses associated card; dragging map updates results if auto-refresh on.
- **Proceed to Checkout** (cart): Navigates to `/checkout` with selected items.
- **Apply promo code**: Validates code; adjusts totals; shows error toast on invalid.
- **Place order / Pay and Book**: Finalizes payment; shows confirmation page.
- **Track** (order): Opens order detail with tracking events; if shipped via integrated carrier, opens carrier page.
- **Return/Refund**: Opens returns modal; selects reason, items, resolution; submits case.
- **Leave review**: Opens review modal; submit publishes to seller/listing.
- **Accept/Decline/Counter** (seller on requests): Updates booking state; Counter opens offer modal to adjust time/price.
- **Withdraw** (payouts): Opens payout modal; confirms transfer to bank.
- **Delete account**: Opens destructive confirm modal requiring text confirmation; permanent action.

---

## Route Map (Representative)

- `/` – Landing
- `/search` – Browse with filters
- `/listing/:id` – Listing detail
- `/cart` – Cart (goods)
- `/checkout` – Checkout
- `/inbox` – Messaging
- `/dashboard/buyer` – Buyer overview
- `/dashboard/buyer/orders` – Orders
- `/dashboard/buyer/bookings` – Bookings
- `/dashboard/buyer/saved` – Saved
- `/sell` – Seller onboarding/home
- `/sell/listings/new` – Listing creator
- `/dashboard/seller` – Seller overview
- `/dashboard/seller/listings` – Listings management
- `/dashboard/seller/orders` – Orders
- `/dashboard/seller/requests` – Booking requests
- `/dashboard/seller/payouts` – Payouts
- `/store/:id` – Seller storefront
- `/settings` – Account settings
- `/help` – Help Center
- `/trust` – Trust & Safety

---

## Accessibility & UX Notes
- All modals focus-trapped; ESC closes (except destructive finalization).
- Buttons have clear labels and disabled states with tooltips explaining why.
- Forms show inline validation and summary on submit.
- Keyboard navigation: Tab order logical; Enter activates primary action; Space toggles.
- Color contrast meets WCAG AA; motion reduced if user prefers-reduced-motion.

---

## Future Enhancements (Optional)
- Collaborative carts for group rentals.
- Price negotiation offers on goods with counter-offers.
- Live video verification for high-value rentals.
- Real-time map availability for services and rentals.

