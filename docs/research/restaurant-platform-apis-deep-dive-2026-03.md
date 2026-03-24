# Restaurant Platform API Deep Dive
**Date:** 2026-03-24
**Purpose:** Actionable developer requirements for building MCP server integrations — solo developer / small startup perspective
**Scope:** Square, Toast, 7shifts, Clover, DoorDash, Uber Eats, OpenTable, Lightspeed Restaurant

---

## How to Read This Document

Each platform answers 10 specific questions:
1. Developer signup process
2. Sandbox / test environment
3. API access during development (before paying customers)
4. Partner program requirements
5. Time to get approved
6. Rate limits
7. OAuth flow for connecting a restaurant account
8. Cost
9. What data you can READ
10. What data you can WRITE

At the end: MCP server architecture notes and an honest "can you develop everything in sandbox without a real restaurant?" answer.

---

## 1. Square

**Priority: Build First. No gates, no approval, broadest surface.**
**Official docs:** https://developer.squareup.com/docs/

### 1. Developer Signup
Just a personal email and a name. The signup asks: your name, email, password, country, and optionally the name of your dev business or employer. A short series of prompts in the developer console. No company registration, no business entity, no EIN. Takes under 5 minutes.

### 2. Sandbox
Fully free, isolated, unlimited API calls. Square automatically provisions a sandbox for every application you create in the Developer Console. Sandbox has separate credentials from production — they cannot be mixed. The API Explorer in the developer console lets you make sandbox calls interactively.

**Sandbox limitations:**
- Square for Restaurants (their specific restaurant POS product) is NOT available in sandbox
- Square hardware (terminals, card readers) cannot be tested on actual devices
- Point of Sale API, Snippets API, Sites API, Reader SDK not supported in sandbox
- No receipt generation, no refund issuance, no subscription editing in sandbox dashboard
- Do not store PII in sandbox (not GDPR-compliant)

### 3. API Access During Development
Yes, full access from day one with just a developer account. You never need a real restaurant account to build and test. You build against sandbox, then when you have a real restaurant connect their account via OAuth, you use their production token.

### 4. Partner Program
Optional. The Square App Marketplace requires being "approved as a Square app partner" before publishing, but you can build and use the API without ever doing this. The partner program is only needed if you want to be listed in their App Marketplace. Approval requires meeting API-specific technical checklists per endpoint used. Revenue sharing programs and referral tracking are available for marketplace partners.

### 5. Time to Approval
- Developer account: immediate
- App Marketplace partner approval: weeks (review process, technical checklist per API used)
- No approval needed just to use the API

### 6. Rate Limits
Rate limits are not published prominently in the official docs (checked multiple pages). Square uses per-endpoint limits and enforces them with HTTP 429 responses. Community guidance suggests ~100 requests/minute per endpoint in production. Sandbox has no rate limits (unlimited calls). Contact Square developer support for exact production limits for your specific API usage pattern.

### 7. OAuth Flow
Standard Authorization Code flow (for server-side apps) and PKCE flow (for mobile/SPAs).

"Connect your Square account" button implementation:
1. Your app redirects merchant to: `https://connect.squareup.com/oauth2/authorize?client_id=YOUR_ID&scope=PERMISSIONS&state=UNIQUE_STATE`
2. Merchant logs in to Square and approves your requested permissions
3. Square redirects to your callback URL with `?code=AUTH_CODE`
4. Your backend POSTs to `ObtainToken` endpoint, exchanging code + client_secret for access token + refresh token
5. Store the access token per restaurant

**Token expiry:**
- Code flow refresh tokens: do NOT expire
- PKCE flow refresh tokens: single-use, expire after 90 days

### 8. Cost
The API is free. Zero per-call charges. You pay Square's standard payment processing rates (2.6% + 10 cents per swipe) only when you process actual payments through the Payments API. Everything else (Orders, Catalog, Inventory, Labor, Customers, Invoices) is completely free with no volume caps.

### 9. What You Can READ
- **Orders**: all orders across locations, with line items, taxes, discounts, fulfillment status, payment links
- **Catalog/Menu**: items, categories, modifiers, pricing rules, images, custom attributes
- **Inventory**: stock levels per item variation, inventory history, state changes (in stock, sold, waste, etc.)
- **Invoices**: all invoices with status, payment requests, customer info, attachments
- **Labor**: timecards (clockin/out, breaks, tips), scheduled shifts, break types, team member wages
- **Customers**: full profiles, contact info, group membership, cards on file, order history
- **Payments**: transaction history, refunds, disputes
- **Locations**: all business locations with address, hours, currency

### 10. What You Can WRITE
- **Orders**: create, update, pay, clone, calculate
- **Catalog**: create/update/delete all catalog objects (items, categories, modifiers, taxes, discounts)
- **Inventory**: adjust stock levels, record waste, receive new stock, reconcile counts
- **Invoices**: create drafts, publish, cancel, delete, add attachments
- **Labor**: create timecards, create/update/publish scheduled shifts, configure break types, set workweek config
- **Customers**: create/update/delete profiles, manage group membership, add custom attributes
- **Payments**: process payments (requires payment instrument), issue refunds

---

## 2. Toast

**Priority: Apply now, build after approval. Largest US market share (~120K+ locations).**
**Official docs:** https://doc.toasttab.com/doc/devguide/

### 1. Developer Signup
Four distinct access types exist. Each has different requirements:

**a) Standard API Access** — self-service for Toast restaurant *customers*. A Toast restaurant owner can buy Standard API access through the Toast Shop and generate credentials in their Toast Web account. They get read-only access to their own restaurant's data. No application process.

**b) Analytics API Access** — similar to Standard but specialized for reporting/operational data. Self-service via Toast Shop.

**c) Custom Integration** — for a restaurant's own IT team or trusted dev partner building something just for that restaurant. Requires the restaurant customer to engage Toast directly.

**d) Partner Integration** — for technology companies (like CarabinerOS) building products for *multiple* Toast restaurants. Requires formal application + certification through the Toast Partner Integrations program.

**For CarabinerOS, Partner Integration is the target.** The application requires: a company (not just personal), a description of your integration use case, and willingness to go through Toast's certification process.

### 2. Sandbox
Toast provides a Partner Developer Environment for approved partners. Access is granted as part of the partner onboarding process — not available before you apply. During the application/certification process, Toast provisions sandbox credentials.

Before partner approval, the closest alternative is signing up for a Toast restaurant trial account (if available) to access Standard API with your own test data.

### 3. API Access During Development
Technically, no — you cannot access other restaurants' Toast data without partner certification. However, if you have a personal Toast restaurant account (real or trial), you can use Standard API credentials to test against your own location's data.

For the partner API: you must complete certification before accessing production data from multiple restaurants.

### 4. Partner Program Requirements
The Toast Partner Integration program includes:
- Formal application to Toast
- Technical certification process (review of your integration spec, security practices, API usage patterns)
- Integration testing with Toast's team
- No specific mention of SOC 2 requirement in public docs, but enterprise security practices are expected
- Revenue share not documented publicly — likely in the partner agreement

Toast is not shy about being selective. They want integrations that add genuine value and don't abuse API access.

### 5. Time to Approval
Weeks to months. No public SLA. Community reports suggest 4-8 weeks minimum for partner certification once you've submitted a complete application. Complex integrations or those with security review take longer.

### 6. Rate Limits
Not publicly documented. Published in partner agreements. Toast's API uses per-location rate limiting. From community reports: approximately 250-500 requests/minute per location in production. Standard API is more restrictive than Partner API.

### 7. OAuth Flow
Toast uses OAuth2 client credentials (server-to-server). The flow is:
1. Each Toast restaurant logs in to their Toast Web account and installs/authorizes your integration
2. Your app receives a restaurant GUID and credentials
3. You exchange client credentials for a bearer access token per restaurant
4. Tokens are short-lived; refresh as needed

There is no user-facing "Connect your Toast account" OAuth button in the traditional sense. The restaurant admin authorizes through the Toast back-office web interface, not through a redirect to your app. Your app gets notified via webhook or polling.

### 8. Cost
Standard API: paid through Toast Shop (cost not publicly listed; approximately $100-200/month per location based on community reports). Partner API: likely negotiated per partner agreement, possibly free in exchange for driving restaurant sales to Toast.

### 9. What You Can READ
- **Orders**: order detail, checks, payments, order types, voids, refunds
- **Menus**: menu items, modifiers, prices, availability, pricelists
- **Inventory/Stock**: item availability (86'd items), stock counts (limited)
- **Employees**: employee records, job assignments, shifts, time entries
- **Restaurant Info**: location info, hours, tables, dining options
- **Cash**: cash drawer entries, deposits
- **Analytics**: sales summaries, labor reports, product mix (Analytics API)
- **Webhooks**: real-time events for orders, payments, menu changes

### 10. What You Can WRITE
- **Orders**: create/update orders, apply discounts, process voids (partner-level access)
- **Menu**: update item availability, 86 items, update prices (partner-level)
- **Stock/Availability**: update availability/out-of-stock status
- Limited write access compared to read. Toast is conservative about third-party writes to prevent data corruption.

---

## 3. 7shifts

**Priority: Build in Phase 1. Self-service, no approval gate.**
**Official docs:** https://developers.7shifts.com/

### 1. Developer Signup
Self-service. Agree to the API Terms of Use, create an access token or OAuth client via Company Settings > Developer Tools. No company required, no formal application. You need a 7shifts account to start (free trial available).

### 2. Sandbox
No dedicated sandbox environment documented. You develop against your own 7shifts account (trial or paid). The API uses real data from your account. There is no separate isolated test environment.

### 3. API Access During Development
Yes, with your own 7shifts account. You can develop the full integration using your personal account's data. OAuth clients can be created immediately after agreeing to API terms. You do not need a real restaurant to test — just a 7shifts account with some test data you create manually.

### 4. Partner Program
7shifts has a "Become a Partner" program for technology integrations. The partner program is referenced in their docs and website but not fully documented publicly. Partners likely get support, co-marketing, and potentially dedicated API credentials separate from personal tokens. The regular API is accessible without being a formal partner.

### 5. Time to Approval
API access: immediate (after Terms of Use agreement). Partner program: unknown, contact 7shifts partnerships team.

### 6. Rate Limits
**10 requests per second per token across all API endpoints.** This is clearly documented. No daily limit mentioned. At 10 req/sec, you can make 36,000 requests per hour — sufficient for all restaurant management use cases.

### 7. OAuth Flow
Standard OAuth2 client credentials + bearer token flow. For partner integrations:
1. Create an OAuth Client in your 7shifts developer settings
2. Obtain a bearer token using client credentials
3. Tokens expire after 1 hour; use refresh flow to obtain new ones
4. For connecting another restaurant's 7shifts account to your app, the restaurant admin generates an API token from their account settings and provides it to you

Note: **All authentication methods provide administrator-level access. You cannot scope permissions to specific resources.** This is a significant limitation — every token is a full admin token.

### 8. Cost
API access is free. 7shifts itself requires a paid subscription (pricing tiers based on number of employees, starting around $29.99/month per location). You need one account to develop; connecting other restaurants requires each restaurant to have their own 7shifts subscription.

### 9. What You Can READ
- **Employees**: user profiles, employment records, wage rates, roles, locations
- **Schedules**: published and draft shifts, assignments, shift swaps
- **Time Punches**: clock-in/out times, break times (for payroll integration)
- **Labor Reports**: hours, wages, overtime, daily sales vs. labor ratios
- **Sales Data**: receipt/sales data (if restaurants integrate their POS with 7shifts)
- **Availability**: employee availability windows, time-off requests
- **Tips**: tip pool data (if configured)

### 10. What You Can WRITE
- **Employees**: create, update employee records
- **Schedules**: create, update, delete shifts
- **Time Punches**: create, update time punch data
- **Sales/Receipts**: push POS sales data into 7shifts (for their AI scheduling)
- Full admin-level write access to all resources

---

## 4. Clover

**Priority: Build in Phase 1-2. Developer program, no formal partner agreement required.**
**Official docs:** https://docs.clover.com/

### 1. Developer Signup
Free account creation at sandbox.dev.clover.com. Process:
1. Enter email, receive confirmation link
2. Set password
3. Provide your name, choose a public developer name
4. Create your first test merchant (automated)
5. Enable 2FA

No company, no EIN, no business entity required for sandbox. For production, you need an "approved production developer account" before Clover will approve your apps. Production approval requires submitting your developer account for review (Clover's team reviews it).

### 2. Sandbox
Yes — fully separate sandbox environment at sandbox.dev.clover.com. When you create your developer account, you get test merchants automatically. You can create additional test merchants. Sandbox is free, isolated from production.

### 3. API Access During Development
Yes. Full API development in sandbox with your test merchant data. You can build and test the complete OAuth flow using sandbox credentials without a real restaurant.

### 4. Partner Program
Production apps require Clover's app approval process (submitted via Developer Dashboard). There is no separate "partner program" — any developer can publish to the Clover App Market after passing the functional review. The review process involves:
- App functionality testing
- Design requirements check
- Admin onboarding checklist
- Functional review playbook (Clover's internal QA)

No revenue share, no annual fee, no security certification like SOC 2 (at least not publicly required).

### 5. Time to Approval
Developer account: immediate (sandbox). Production developer account approval: days to 1-2 weeks (human review). App Market approval: additional weeks after production account is approved.

### 6. Rate Limits
Not publicly documented in the accessible pages. Clover's docs reference a "Work with API usage and rate limits" tutorial, but the specific numbers weren't accessible. Community reports suggest approximately 10 requests/second per merchant in production.

### 7. OAuth Flow
Clover supports three flows:
- **Authorization Code (high-trust apps)**: standard code flow with client_secret. For server-side apps.
- **Authorization Code + PKCE (low-trust apps)**: for mobile/SPA apps without a secret
- **Implicit (legacy)**: deprecated, migrate away from this

"Connect your Clover account" flow:
1. Redirect merchant to Clover's authorization endpoint
2. Merchant logs in and approves your app
3. Clover returns authorization code to your callback URL
4. Exchange code for access_token + refresh_token
5. access_token is short-lived; refresh_token refreshes it

Tokens are per-merchant. Store one access_token per connected restaurant.

### 8. Cost
Sandbox: free. Production: free to use the REST API. No per-call charges. Clover hardware and payment processing have their own fees. App Market listing: free to submit; revenue share on in-app purchases if you charge for your app.

### 9. What You Can READ
- **Orders**: order history, line items, modifiers, status, tender types
- **Payments**: payment transactions, refunds, voids
- **Inventory**: items, categories, modifiers, tax rates, discounts, pricing
- **Customers**: customer profiles, contact info, purchase history
- **Employees**: employee records, roles, shifts
- **Merchant Config**: locations, business info, device setup

### 10. What You Can WRITE
- **Orders**: create orders, add items, apply discounts
- **Inventory**: create/update/delete items, categories, modifiers, taxes
- **Customers**: create/update/delete customer profiles
- **Employees**: create/update employee records
- Full read/write via REST API with appropriate OAuth scopes

---

## 5. DoorDash

**Two completely separate APIs. Do not confuse them.**
**Official docs:** https://developer.doordash.com/

### DoorDash Drive API (White-Label Delivery)
This is the "I have my own ordering system and I want DoorDash couriers to deliver for me" API. The restaurant takes orders themselves (via their website, POS, etc.) and DoorDash provides the courier logistics.

### 1. Developer Signup (Drive)
Create an account at the Developer Portal (developer.doordash.com). Standard email signup. No company required for sandbox. You immediately get access to sandbox credentials.

### 2. Sandbox (Drive)
Yes — free, immediate sandbox access. "You can experiment with the API as much as you like without incurring real costs or hailing real Dashers." The sandbox includes a Delivery Simulator that lets you advance deliveries through stages (created → picked up → delivered) without real couriers. Unlimited sandbox usage.

### 3. API Access During Development (Drive)
Full sandbox development without a real restaurant. Build the entire integration, test the complete delivery lifecycle, before touching production.

### 4. Partner Program / Production Access (Drive)
**Critical warning:** "Production access to the Drive API is currently restricted, and we cannot provide a timeline for certification following development."

Production requires submitting a production access request. Approval is not guaranteed. DoorDash is gating Drive production access — they appear to be selective about which platforms can dispatch real Dashers through the API.

### 5. Time to Approval (Drive)
Sandbox: immediate. Production: unknown, no SLA given. Community reports: weeks to months, with some developers waiting indefinitely. Apply early.

### 6. Rate Limits (Drive)
Not publicly documented.

### 7. Auth Flow (Drive)
Not OAuth. Uses JWT (HS256 signed):
1. Create an "Access Key" in the Developer Portal — gives you `developer_id`, `key_id`, `signing_secret`
2. For each API request, generate a JWT signed with your signing_secret
3. Pass the JWT as Bearer token in the Authorization header
4. No per-restaurant token — your credentials represent you as the caller, not individual restaurants

### 8. Cost (Drive)
API is free. You pay a per-delivery fee when dispatching real Dashers in production (negotiated rate, typically a flat fee per delivery based on distance/volume).

### 9. What You Can READ (Drive)
- Delivery status (created, courier assigned, pickup, in transit, delivered, failed)
- Delivery details (courier info, ETA, pickup/dropoff addresses)
- Delivery quote (estimated cost and time)

### 10. What You Can WRITE (Drive)
- Create deliveries (specify pickup address, dropoff address, items, tip)
- Cancel deliveries
- Accept/reject delivery quotes

---

### DoorDash Marketplace API (Appearing on the DoorDash App)
This is the "I want my restaurant to appear on DoorDash.com and the DoorDash app" API. It handles menu sync, order injection into the restaurant's POS, and store management.

### Status
**Early access only. Submit an interest form on developer.doordash.com.** DoorDash contacts applicants "as bandwidth becomes available." This is not self-service.

### What It Does (When Available)
- Menu sync: create/update your restaurant's menu on DoorDash
- Order webhooks: receive live orders from DoorDash into your system
- Store management: control hours, online/offline status
- This is the "POS integration" API used by companies like Otter, Olo, and Omnivore

For CarabinerOS, this is the high-value API (see orders from DoorDash in the agent dashboard without touching the tablet), but it's not accessible today without early access approval.

---

## 6. Uber Eats

**Priority: Apply immediately, build after approval. Required for delivery-focused restaurants.**
**Official docs:** https://developer.uber.com/docs/eats/

### 1. Developer Signup
Requires written approval from Uber before you get API access. Process:
1. Create a developer account at developer.uber.com
2. Submit an application (contact form / Uber partner manager)
3. Complete NDA and API licensing agreement
4. Speak with your Uber Eats partner manager about use case
5. Get approved for a testing application (sandbox)
6. Build and validate
7. Get approved for production

This is NOT self-service. You need to be an existing Uber Eats partner or go through their business development process.

### 2. Sandbox
Yes — sandbox stores are provisioned after you're approved for testing. You cannot access even the sandbox without initial approval.

### 3. API Access During Development
No. You need approval first, then you get sandbox credentials with test stores.

### 4. Partner Program Requirements
- NDA required
- API licensing agreement required
- Must have an Uber Eats partner manager assigned to you
- Must pass a production validation process (99% injection success rate)
- No public mention of SOC 2 requirement, but enterprise security practices expected

### 5. Time to Approval
No public SLA. Typically 2-6 weeks to get initial sandbox access after submitting. Full production approval (including the 99% injection rate validation) adds additional time. Budget 4-12 weeks total.

### 6. Rate Limits
Not publicly documented. Partner agreement specifies limits.

### 7. OAuth Flow
OAuth 2.0 with scopes. Separate credentials for test vs. production environments. Tokens expire after 30 days. Bearer token in Authorization header. Standard code flow for server-side apps.

### 8. Cost
API itself is free. Uber Eats takes a percentage commission on orders processed through their platform (typically 15-30% depending on tier and contract). No per-API-call charges.

### 9. What You Can READ
- **Menu**: items, pricing, availability, categories
- **Orders**: incoming orders with items, customer location, special instructions
- **Store**: current online/offline status, hours
- **Reporting**: transaction reports, performance metrics, analytics

### 10. What You Can WRITE
- **Menu**: sync full menu, update item availability/pricing, mark items out of stock
- **Orders**: accept, deny, update status (picked up, delivered), adjust item availability
- **Store**: update hours, toggle online/offline status
- **Promotions**: create and manage campaigns

---

## 7. OpenTable

**Priority: Apply now; high value for labor planning. Gated partner program.**
**Official docs:** https://platform.opentable.com/ (login required; partner portal on Salesforce Experience Cloud)
**Public reference:** https://developer.opentable.com/

### 1. Developer Signup
Not self-service. Requires a formal partnership application with OpenTable. The developer portal is a Salesforce Experience Cloud instance — meaning every access request goes through a human relationship manager. You do not sign up with just an email.

To apply: contact OpenTable Partnerships via their website or approach through an existing restaurant that uses OpenTable and wants you to connect.

### 2. Sandbox
Sandbox access is part of the partner onboarding process, provided after approval. Not available before partnership.

### 3. API Access During Development
No. You must be approved as a partner before getting any API credentials.

### 4. Partner Program Requirements
OpenTable's integration partners are typically:
- POS vendors (Toast, Square integrating table data)
- CRM / marketing platforms
- Table management systems
- Restaurant analytics tools

Requirements are not publicly documented but based on the gated access model, they likely include: business entity, demonstrated restaurant software product, and a specific integration use case that complements OpenTable rather than competing with it.

### 5. Time to Approval
Weeks to months based on relationship complexity. OpenTable partnership is a business development engagement, not a technical self-service process.

### 6. Rate Limits
Not publicly documented.

### 7. OAuth Flow
OAuth2 or API key depending on integration type. The exact flow is documented in the partner portal (login required). Based on standard patterns for reservation platforms: restaurant authorizes your app through OpenTable's admin interface, you receive credentials for that restaurant.

### 8. Cost
No public pricing. Partnership agreements likely include revenue share or co-marketing commitments rather than direct API fees.

### 9. What You Can READ
- **Reservations**: upcoming reservations with date/time, covers (party size), table assignment
- **Guest Profiles**: guest history, visit count, dining preferences, contact info (with consent)
- **Availability**: open slots, floor plan, waitlist length
- **Reports**: covers by shift, no-show rates, average spend per cover

### 10. What You Can WRITE
- Depends on integration type. Full integration partners can:
  - Create/modify reservations
  - Update guest notes
  - Manage floor plan
  - Accept/seat parties

---

## 8. Lightspeed Restaurant

**Priority: Apply during Phase 2. Strong in Canada/Europe.**
**Official docs:** https://developers.lightspeedhq.com/restaurant/

### 1. Developer Signup
Lightspeed has multiple distinct restaurant API products (K-Series, L-Series, O-Series, G-Series — each is a different product line they acquired). The developer portal at developers.lightspeedhq.com serves as a hub, but the contact info for getting access is a phone number (866-932-1801) or contact form. Not clearly self-service.

For the L-Series (Lightspeed Restaurant, the main product), developer access requires enrolling in their developer program. Contact Lightspeed directly.

### 2. Sandbox
Sandbox environment exists as part of developer program enrollment. Not publicly accessible before enrollment.

### 3. API Access During Development
Requires developer program enrollment. Not self-service.

### 4. Partner Program Requirements
Not publicly detailed. Lightspeed has a partner/integration ecosystem but requirements are disclosed during the business development process.

### 5. Time to Approval
Unknown (no public SLA). Based on the phone/contact-form-only access model: days to weeks for initial sandbox access.

### 6. Rate Limits
Not publicly documented.

### 7. OAuth Flow
OAuth 2.0 based on documentation references. Standard code flow, restaurant admins authorize your app. Specific implementation details in developer program docs (not publicly accessible).

### 8. Cost
No public pricing for API access. Lightspeed restaurants pay Lightspeed for their POS subscription; developer API access is typically free for partners.

### 9. What You Can READ (L-Series)
- **Orders/Checks**: table orders, check totals, line items, payment methods
- **Menu/Catalog**: items, categories, modifiers, pricing
- **Tables**: table assignments, floor plan status
- **Payments**: transaction records
- **Reports**: sales summaries, product mix

### 10. What You Can WRITE (L-Series)
- **Orders**: create, update orders
- **Menu**: update item availability, pricing
- **Reservations**: depends on configuration
Scope of write access depends on integration tier.

---

## MCP Server Architecture Notes

### What is an MCP Server in This Context

The Model Context Protocol (MCP) is Anthropic's standard for giving AI agents structured access to external systems. An MCP server is a process that:
1. Exposes a set of "tools" (functions with typed inputs/outputs)
2. An AI agent (like CarabinerOS's Agent Zero) calls those tools by name
3. The MCP server makes authenticated API calls to the underlying REST API and returns structured results

Your existing `carabiner_db` MCP server wraps PostgreSQL — the agent calls `query_database(sql)` and gets rows back.

A Square MCP server would expose tools like:
- `square_get_orders(location_id, start_date, end_date)` → list of orders
- `square_get_inventory(location_id, item_ids)` → current stock levels
- `square_update_inventory(location_id, adjustments)` → write stock changes
- `square_get_labor(location_id, week)` → timecard data

The agent then calls these tools the same way it queries your database — by natural language intent mapped to tool calls.

### Typical Architecture for Multi-Restaurant OAuth

```
CarabinerOS Database (PostgreSQL)
  └── restaurant_integrations table
        └── restaurant_id → platform → encrypted_access_token + refresh_token + expires_at

MCP Server (e.g., square_mcp.py)
  └── On each tool call:
        1. Look up the restaurant's access token from the DB
        2. Check if token is expired; refresh if needed
        3. Make authenticated REST call to Square API
        4. Return structured data to the agent

OAuth Flow (when a restaurant connects their account)
  └── Restaurant admin clicks "Connect Square account" in CarabinerOS UI
  └── Redirect to Square OAuth authorize URL
  └── Restaurant approves in Square
  └── Square redirects back to CarabinerOS callback URL with auth code
  └── Backend exchanges code for access_token + refresh_token
  └── Store encrypted tokens in restaurant_integrations table
  └── MCP server now has credentials for that restaurant
```

### Python MCP Server Implementation

Using FastMCP (the Anthropic-maintained Python SDK):

```python
from mcp.server.fastmcp import FastMCP
import httpx

mcp = FastMCP("square")

@mcp.tool()
async def get_orders(location_id: str, start_date: str, end_date: str) -> dict:
    """Retrieve Square orders for a restaurant location."""
    token = await get_access_token(location_id)  # from your DB
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://connect.squareup.com/v2/orders/search",
            headers={"Authorization": f"Bearer {token}"},
            json={"location_ids": [location_id], "query": {...}}
        )
        return response.json()
```

### Can You Build All of These With Just a Developer Account and Sandbox?

| Platform | Sandbox Without Real Restaurant? | Notes |
|---|---|---|
| **Square** | YES | Full sandbox, unlimited calls, zero gates |
| **Toast** | NO | Need partner certification for multi-restaurant; Standard API needs a real Toast restaurant account |
| **7shifts** | Partial | Use your own free trial account as test data |
| **Clover** | YES | Sandbox auto-provisions test merchants |
| **DoorDash Drive** | YES | Free sandbox with delivery simulator |
| **DoorDash Marketplace** | NO | Early access waitlist; no sandbox before approval |
| **Uber Eats** | NO | Approval required before any access |
| **OpenTable** | NO | Partner program required before any access |
| **Lightspeed** | NO | Developer program enrollment required |

**Honest answer:** You can build Square, Clover, and DoorDash Drive integrations completely in sandbox before you have a single real restaurant customer. For everything else, you either need to go through an approval process first or use your own account as test data (7shifts). Toast, Uber Eats, OpenTable, and Lightspeed all require human approval before you see any data.

---

## Priority Build Order for CarabinerOS MCP Servers

### Phase 1 — Start Today (no approval needed)

1. **Square MCP** — Free, comprehensive, broadest API surface. Orders + menu + inventory + labor + invoices + customers. Full sandbox. Zero barriers. This should be the reference implementation for all other MCP servers.

2. **Clover MCP** — Free sandbox, auto-provisioned test merchants. Orders + inventory + employees + customers. Build this right after Square.

3. **DoorDash Drive MCP** — Free sandbox with delivery simulator. White-label delivery dispatch. Useful for ghost kitchens and delivery-focused clients.

4. **7shifts MCP** — Use your own 7shifts trial account as test data. Labor schedules + timecards + wage data. 10 req/sec rate limit. Admin-level access only (no scope restriction available).

### Phase 2 — Apply Now, Build While Waiting

5. **Toast MCP** — Submit partner integration application immediately. Largest US market share. Will take weeks to get sandbox access. While waiting, build the MCP scaffold against the API spec.

6. **Lightspeed MCP** — Contact developer program. Relevant for Canadian and European restaurants. L-Series is the target product.

### Phase 3 — Apply Now for Strategic Positioning

7. **Uber Eats MCP** — Submit partner application now even though build is months away. High value for delivery-heavy restaurants. Menu sync + order management.

8. **OpenTable MCP** — Start partnership conversation now. Reservation + cover data feeds labor planning ("180 covers booked for Friday dinner service, schedule 3 line cooks").

---

## Key Developer URLs

| Platform | Developer Portal | Docs |
|---|---|---|
| Square | https://developer.squareup.com | https://developer.squareup.com/docs/ |
| Toast | https://doc.toasttab.com | https://doc.toasttab.com/doc/devguide/ |
| 7shifts | https://developers.7shifts.com | https://developers.7shifts.com/docs/ |
| Clover | https://sandbox.dev.clover.com | https://docs.clover.com/ |
| DoorDash | https://developer.doordash.com | https://developer.doordash.com/en-US/docs/ |
| Uber Eats | https://developer.uber.com | https://developer.uber.com/docs/eats/ |
| OpenTable | https://platform.opentable.com | Partner portal (login required) |
| Lightspeed | https://developers.lightspeedhq.com | https://developers.lightspeedhq.com/restaurant/ |
