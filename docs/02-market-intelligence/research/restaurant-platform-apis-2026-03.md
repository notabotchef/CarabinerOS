# Restaurant Platform API Research
**Date:** 2026-03-24
**Purpose:** Evaluate public/partner APIs for integration into CarabinerOS via MCP servers

---

## Summary Table

| Platform | Has Public API | API Type | Auth Method | Availability | Key Data Exposed | MCP Needed? |
|---|---|---|---|---|---|---|
| **Toast** | Yes | REST + Webhooks | OAuth2 (client credentials) | Partner program required (standard self-service also available) | Orders, payments, menus, stock, employees, cash, analytics | Yes — wrap in MCP |
| **xtraCHEF / Plate IQ** | Absorbed into Toast | — | — | Now Toast-native; no standalone API confirmed | Invoice/food cost (via Toast) | Via Toast MCP |
| **OpenTable** | Yes (partner-only) | REST | OAuth2 / API Key | Formal partner program, not self-service | Reservations, covers, guest data, waitlist | Yes — wrap in MCP |
| **Resy** | Unclear / not public | Unknown | Unknown | No public developer portal found | Reservations (if accessible) | Scrape or partnership required |
| **Square** | Yes — fully public | REST + Webhooks | OAuth2 (code flow + PKCE) | Free self-service; no partner program required | Orders, catalog/menu, inventory, invoices, labor, timecards, customers, payments | Yes — wrap in MCP |
| **Clover** | Yes — developer program | REST | Bearer token (per-merchant) | Free developer account; app approval for production | Orders, payments, inventory, employees, customers, devices | Yes — wrap in MCP |
| **ChowNow** | No confirmed public API | — | — | No developer portal found; integration-only via POS partners | Online orders (indirectly) | Not viable without direct relationship |
| **DoorDash Drive** | Yes | REST | JWT (HS256 signed) | Self-service developer account; free sandbox | Delivery creation, delivery status, quote/accept flow | Yes — wrap in MCP |
| **DoorDash Marketplace** | Limited / early access | REST + Webhooks | Unknown (likely JWT) | Early access interest form required | Menu management, order webhooks, store availability | Not yet viable; waitlist |
| **Uber Eats** | Yes (restricted) | REST + Webhooks | OAuth2 | Written approval from Uber required; not self-service | Menu sync, order processing, store ops, promotions, reporting | Yes — wrap in MCP (after approval) |
| **MarketMan** | Yes (Enterprise tier) | REST | API Key / Partner | Enterprise plan required; partner marketplace | Inventory, purchasing, recipe costing, expense tracking | Yes — wrap in MCP |
| **BlueCart** | No confirmed public API | — | — | No developer portal found; one known integration (BinWise) | Procurement orders (indirectly) | Not viable without direct relationship |
| **7shifts** | Yes — Partner API | REST | OAuth2 (client credentials) + API Key | Self-service; API Terms of Use agreement | Schedules, timesheets, employees, wages, sales/labor reports | Yes — wrap in MCP |
| **Lightspeed Restaurant** | Yes (multiple series: K, L, O, G) | REST | OAuth2 | Developer program; multiple product lines | POS orders, menu, tables, payments (varies by series) | Yes — wrap in MCP |
| **Olo** | Yes (via Omnivore) | REST + Webhooks | Unknown (partner-controlled) | Partner-focused; not self-service | Digital orders, menu sync, store webhooks, loyalty | Yes — wrap in MCP (after partnership) |

---

## Per-Platform Detail

### 1. Toast POS
- **Public API:** Yes
- **API surface:** Orders, payments, menus, stock/availability, employees, cash entries, restaurant info, analytics, webhooks, outbound integrations
- **Auth:** OAuth2 client credentials. Toast-owned restaurants use Standard API (self-service). External technology companies must apply to the Toast Partner Integrations program (formal application + certification).
- **Availability:** Standard API is self-service for Toast restaurant customers. Building a product for *other* restaurants requires partner certification.
- **Docs:** `https://doc.toasttab.com/doc/devguide/index.html`
- **MCP verdict:** Yes — wrap REST calls in an MCP server. Toast's API is the gold standard for US restaurant POS integrations, covering ~120K+ restaurant locations.

### 2. xtraCHEF (now part of Toast)
- **Public API:** No standalone API. xtraCHEF was acquired by Toast and is now the Toast Invoicing / Food Cost module.
- **API surface:** Invoice capture, food cost, AP automation — accessible only through the Toast ecosystem.
- **MCP verdict:** Covered under Toast MCP. No separate integration needed.

### 3. Plate IQ (now Ottimate)
- **Public API:** Plate IQ rebranded to Ottimate. They have AP automation integrations (accounting, ERP) but no confirmed public REST API for restaurant operators.
- **Availability:** Appears to require direct sales engagement.
- **MCP verdict:** Not viable as a direct integration today. Monitor for API announcement.

### 4. OpenTable
- **Public API:** Yes, but gated behind a formal partner portal (`dev.opentable.com`).
- **API surface:** Reservations, covers, guest profiles, waitlist management, availability — the standard reservation management data set.
- **Auth:** OAuth2 or API key (partner-issued). The developer portal is a Salesforce Experience Cloud instance, confirming it's an enterprise relationship, not self-service.
- **Availability:** Requires partnership application. OpenTable partners with POS vendors, table management systems, and CRM platforms.
- **Docs:** `https://platform.opentable.com/documentation` (redirects to partner portal login)
- **MCP verdict:** Yes — high value if you can get partner access. Reservation + cover data is critical for labor planning and kitchen prep forecasting.

### 5. Resy
- **Public API:** No public developer portal or documented API found. Resy (now owned by American Express) does not appear to offer a self-service or partner API.
- **Availability:** Would require a direct business relationship with Resy/Amex.
- **MCP verdict:** Not viable. If reservation data is needed from Resy venues, consider screen-scraping their management portal or waiting for an official API announcement.

### 6. Square
- **Public API:** Yes — fully open, free, self-service.
- **API surface:** Extremely broad:
  - **Orders API**: Create/update/search orders, fulfillment, taxes, discounts
  - **Catalog API**: Menu items, categories, modifiers, pricing rules
  - **Inventory API**: Stock adjustments, waste tracking, restocking, historical changes
  - **Invoices API**: Draft/publish/cancel invoices, payment scheduling, attachments
  - **Labor API**: Timecards, scheduled shifts, wage rates, break tracking
  - **Customers API**: Profiles, groups, loyalty
  - **Payments API**: Process/refund, multiple tender types
  - **Locations API**: Multi-location management
  - **Webhooks**: Real-time event streaming for all major objects
- **Auth:** OAuth2 (authorization code + PKCE). Access tokens expire in 30 days; refresh tokens available. Bearer token header.
- **Availability:** Free developer account, sandbox environment, no partner program required. App Marketplace available for publishing.
- **Docs:** `https://developer.squareup.com/docs/`
- **MCP verdict:** Yes, and this should be the first MCP server built. Square has the broadest API surface of any restaurant-relevant platform, is completely free to integrate, and covers orders + menu + inventory + labor + invoicing in a single API.

### 7. Clover
- **Public API:** Yes — developer program, no formal partner agreement required for development.
- **API surface:** Orders, payments, inventory (items/categories/modifiers/discounts/taxes), customers, employees, devices, merchant configuration
- **Auth:** Bearer token per-merchant account. Sandbox available. Production requires app approval through Clover's review process.
- **Availability:** Free developer account. App must pass review before accessing production merchants. US and Canada for ecommerce features.
- **Docs:** `https://docs.clover.com/reference/api-reference-overview`
- **MCP verdict:** Yes — build after Square. Clover has strong penetration in SMB restaurant space. The per-merchant token model means each restaurant authorizes individually (standard OAuth-style flow in practice).

### 8. ChowNow
- **Public API:** No confirmed public API. ChowNow's integrations page lists POS partnerships (Toast, Square, etc.) but no developer-facing API or documentation portal was found.
- **Availability:** Would require direct negotiation with ChowNow's partnerships team.
- **MCP verdict:** Not viable as a first-party integration. ChowNow's online orders can be accessed indirectly if the restaurant's POS (Toast/Square) receives ChowNow orders.

### 9. DoorDash Drive
- **Public API:** Yes — self-service developer account.
- **API surface:** Delivery operations: create delivery, retrieve status, quote delivery, advance delivery states (pickup → enroute → delivered). This is the "white-label delivery" API (restaurant uses their own ordering system, DoorDash provides the courier).
- **Auth:** JWT (HS256). Developer creates an access key with `developer_id`, `key_id`, and `signing_secret`. Tokens are signed JWTs passed as Bearer in Authorization header.
- **Availability:** Developer account is free. Sandbox available. Production requires agreement.
- **Docs:** `https://developer.doordash.com/en-US/docs/drive/`
- **MCP verdict:** Yes — useful for CarabinerOS when restaurants want to dispatch deliveries. Drive is distinct from the DoorDash Marketplace (where restaurant appears on DoorDash app). High value for ghost kitchen and delivery-focused clients.

### 10. DoorDash Marketplace API
- **Public API:** Limited early access only.
- **API surface:** Menu management (create/update items on DoorDash), order webhook (receive live orders), store availability/hours control.
- **Auth:** Not publicly documented. Likely JWT like Drive.
- **Availability:** Early access interest form; DoorDash contacts applicants "as bandwidth becomes available." Not self-service.
- **MCP verdict:** Not viable today. Monitor and apply for early access. When available, this would allow CarabinerOS to manage a restaurant's DoorDash presence (menu sync, order injection into POS) without manual DoorDash tablet management.

### 11. Uber Eats
- **Public API:** Yes, but requires written approval from Uber.
- **API surface:** Six API suites: Integration Configuration (onboarding), Menu (sync items/pricing), Store (hours/online status), Order (processing/fulfillment), Promotions (campaign management), Reporting (analytics/metrics). Supports BYOC (Bring Your Own Courier).
- **Auth:** OAuth2 with scopes. Production requires 99% injection success rate.
- **Availability:** Must contact Uber for access. Not self-service.
- **Docs:** `https://developer.uber.com/docs/eats/`
- **MCP verdict:** Yes — high strategic value for delivery-heavy restaurants. Apply for access early as approval takes time. Once approved, this enables menu sync and order management for Uber Eats venues.

### 12. MarketMan
- **Public API:** Yes — available on Enterprise plan ("Open API Access").
- **API surface:** Inventory tracking, purchasing/ordering, recipe costing, expense/food cost analysis. MarketMan is purpose-built for restaurant back-of-house operations.
- **Auth:** API key or Partner program credentials. Has a formal Partner Marketplace.
- **Availability:** Enterprise tier required; partner marketplace for tech integrations.
- **Docs:** No public documentation URL confirmed. Contact required.
- **MCP verdict:** Yes — extremely high value. MarketMan is one of the most widely used restaurant inventory management platforms. An MCP wrapper would let Agent Zero query live inventory levels, purchasing history, and recipe costs.

### 13. BlueCart
- **Public API:** No public API found. BlueCart appears to be a procurement platform with a single confirmed integration (BinWise for beverage inventory).
- **Availability:** No developer portal or API documentation exists publicly.
- **MCP verdict:** Not viable. BlueCart's value proposition is their supplier marketplace. If a restaurant uses BlueCart for ordering, CarabinerOS cannot access that data without a direct partnership.

### 14. 7shifts
- **Public API:** Yes — Partner API with self-service access (requires API Terms of Use agreement).
- **API surface:** Employee management (create/update/read staff, wages, employment records), scheduling (shifts, enforcement), labor data (time punches), sales integration (receipts, projections, tip pools), reports (hours/wages, daily sales/labor).
- **Auth:** OAuth2 (client credentials flow) for production integrations; API key (bearer token) for personal use. Admin-level access only — no scope restriction available.
- **Docs:** `https://developers.7shifts.com/docs/getting-started`
- **Availability:** Self-service with Terms of Use agreement. No formal partner approval required.
- **MCP verdict:** Yes — high value. 7shifts is the dominant labor management platform for US restaurants. Reading labor cost data and schedule adherence into CarabinerOS's P&L and forecasting models would be immediately actionable.

### 15. Lightspeed Restaurant
- **Public API:** Yes — multiple product series (K-Series, L-Series, O-Series, G-Series), each with their own API.
- **API surface:** POS orders, menu/catalog management, table management, payments. Scope varies by series. L-Series (Lightspeed Restaurant's main product) is the most relevant.
- **Auth:** OAuth2. Developer program enrollment required.
- **Availability:** Developer program; some series require direct partnership. K-Series and L-Series are most accessible.
- **Docs:** `https://developers.lightspeedhq.com/`
- **MCP verdict:** Yes — relevant for non-Toast/Square restaurants, particularly in Canada and Europe where Lightspeed has strong market share.

### 16. Olo
- **Public API:** Yes, via Olo Open Platform and Omnivore middleware.
- **API surface:** Digital ordering (online/mobile orders), menu sync, store webhooks, loyalty/rewards integration. Olo acts as a middleware aggregator for restaurant digital ordering — they sit between the restaurant's POS and online ordering channels.
- **Auth:** Partner-controlled. Omnivore API connects to 12 POS systems. Webhook-based architecture.
- **Availability:** Partner-focused. Must talk to Olo partnerships. Not self-service.
- **Docs:** `https://www.olo.com/omnivoreapi`
- **MCP verdict:** Yes — strategic value for restaurant groups using Olo (primarily enterprise chains). An MCP integration would let CarabinerOS ingest digital order data across all channels without touching individual POS APIs.

---

## Feasibility Tiers

### Tier 1: Build Now (self-service, high value, no approval gate)

| Platform | Why |
|---|---|
| **Square** | Free, comprehensive, orders + menu + inventory + labor + invoices in one API. Broadest surface of any platform. |
| **DoorDash Drive** | Self-service JWT auth, useful for delivery dispatch. Delivery is a core restaurant workflow. |
| **7shifts** | Self-service OAuth2, dominant labor platform. Labor cost is the #1 controllable expense in restaurants. |
| **Clover** | Developer program, no formal partner required. Large SMB install base. |

### Tier 2: Apply Now, Integrate After Approval

| Platform | Why | Timeline |
|---|---|---|
| **Toast** | ~120K US restaurant locations. Essential for any serious restaurant SaaS. Standard API is self-service for Toast customers; partner program for multi-restaurant products. | Apply immediately; certification process takes weeks to months |
| **Uber Eats** | Written approval required but major delivery channel. Apply early. | Weeks to months |
| **OpenTable** | Dominant reservation platform. Partner portal access needed. | Weeks |
| **Lightspeed** | Strong in Canada/Europe/upscale dining. Developer program required. | Days to weeks |

### Tier 3: Monitor / Low Priority

| Platform | Why |
|---|---|
| **MarketMan** | Enterprise-only API; high value but small market compared to Toast/Square |
| **Olo** | Enterprise chains only; partner-focused |
| **DoorDash Marketplace** | Early access waitlist; incomplete API surface |

### Tier 4: Not Viable Today

| Platform | Why |
|---|---|
| **Resy** | No public API; Amex-owned; no developer program found |
| **ChowNow** | No public API; POS-mediated integrations only |
| **BlueCart** | No public API; procurement platform without developer access |
| **xtraCHEF / Plate IQ** | Absorbed into Toast; no standalone API |

---

## Recommendations for CarabinerOS MCP Build Order

### Phase 1 (Next 30 days — no approvals needed)
1. **Square MCP** — Broadest data surface, zero barriers, covers orders/menu/inventory/labor/invoices. Build this first.
2. **7shifts MCP** — Labor cost is the top expense category. Pull schedule + timecard + wage data. Essential for daily P&L accuracy.
3. **DoorDash Drive MCP** — Enable delivery dispatch from inside CarabinerOS without switching to DoorDash tablet.

### Phase 2 (Concurrent with approval processes)
4. **Toast MCP** — Apply to partner program now. While waiting for certification, build against the Standard API for your own test restaurant. This will cover the majority of US restaurant customers.
5. **Clover MCP** — Parallel to Toast. Developer program is lighter weight.
6. **Lightspeed MCP (L-Series)** — For Canadian and European restaurants.

### Phase 3 (After approval gates clear)
7. **Uber Eats MCP** — High-volume delivery restaurants need consolidated order management.
8. **OpenTable MCP** — Reservation data feeds labor planning ("covers tonight = 180, need 3 line cooks").
9. **MarketMan MCP** — For restaurants already using MarketMan for inventory.

### Architecture Note
All of these should be built as **separate MCP servers** (one per platform), each exposing a consistent tool interface to Agent Zero:
- `get_orders(location_id, date_range)`
- `get_labor(location_id, week)`
- `sync_menu(location_id, menu_data)`
- etc.

This lets Agent Zero call across platforms transparently. For example: "What was last Tuesday's food cost?" could fan out to Toast (sales data) + MarketMan (inventory consumed) simultaneously.

---

## Notes on xtraCHEF / Plate IQ Consolidation

Both xtraCHEF and Plate IQ are now effectively dead as standalone platforms:
- **xtraCHEF** was acquired by Toast in 2021 and renamed Toast Food Cost Management
- **Plate IQ** rebranded to **Ottimate** and pivoted to general AP automation (beyond restaurants)

For invoice processing and food cost management via Toast, the Toast API is the path forward. For non-Toast restaurants, the current best options are MarketMan (inventory/recipe costing) and Ottimate/accounting system integrations.
