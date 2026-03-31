# Marketing Module — Functional Upgrade Plan

**Date:** 2026-03-24
**Status:** Research complete, ready for implementation
**Module path:** `frontend/src/app/marketing/page.tsx`

---

## 1. Current State

The Marketing page is a read-only campaign viewer with no write functionality.

**Frontend** (`frontend/src/app/marketing/page.tsx`):
- Fetches campaigns from `GET /api/campaigns` via the `useWorkspace` hook
- Displays a **Stage Pipeline** bar (Research / Drafting / Review / Live / Completed)
- **Channel filter** pills (All, Instagram, Facebook, Email, TikTok, Event)
- **Campaign cards** in a 3-column grid showing name, stage badge, channel icon, deliverable, and date
- "New Campaign" button exists in the header but is non-functional
- Empty state nudges the user to ask CarabinerOS to brainstorm content

**Backend** (`carabiner/mcp/server.py`):
- Full CRUD MCP tools exist: `campaigns_list`, `campaigns_get`, `campaigns_create`, `campaigns_update`, `campaigns_delete`
- Flask blueprint exposes `GET /api/campaigns` with optional `?location_id=` filtering

**Database** (`WorkspaceCampaign` in `workspace_models.py`):
- Fields: `id`, `location_id`, `campaign_name`, `channel`, `stage`, `deliverable`, `summary`, `detail_points`, `prompt`
- No fields for: scheduled date, budget, performance metrics, media assets, target audience, or recurring cadence

**Gaps:**
- No way to create, edit, or delete campaigns from the UI
- No content calendar / timeline view
- No social media preview or scheduling
- No email builder or template system
- No loyalty program management
- No review aggregation or response management
- No performance analytics (impressions, clicks, conversions)
- No guest CRM or segmentation
- No event promotion workflow
- Campaign model is too thin for real marketing operations

---

## 2. Competitive Landscape

### Popmenu
- AI-generated marketing content (email copy, social posts)
- Automated email campaigns triggered by guest behavior (past visits, order history)
- Interactive menu pages as SEO-optimized landing pages
- Guest segmentation by visit frequency and spend
- Reputation management dashboard
- ROI tracking tied to campaigns
- Pricing: $159-$449/mo

### BentoBox (Fiserv)
- Automated SMS campaigns triggered by online orders, reservations, events
- Custom segmented guest lists for SMS/email blasts
- Loyalty rewards (points per order or spend threshold)
- SEO-optimized restaurant website as marketing hub
- Integrations: OpenTable, Mailchimp, social platforms
- Event ticketing and catering funnels that feed the CRM

### Olo Engage
- Unified guest data platform across POS, ordering, reservations, loyalty
- Email + SMS + push notifications from one dashboard
- A/B testing for subject lines and email content
- Generative AI for brand-aligned copy
- Machine-learning predictive analytics (churn risk, LTV)
- Pre-built marketing automations (win-back, welcome series, birthday)
- Recently acquired Spendgo for integrated loyalty

### Toast Marketing
- Points-based loyalty built into POS
- AI writing assistant for email campaigns (input goals + tone, get layout + copy)
- One-click automated campaigns powered by guest data
- Triggered emails: post-visit thank-you, birthday, dormant guest win-back
- Receipt-printed loyalty balances for passive awareness
- $185/mo as part of Marketing Essentials bundle

### SevenRooms
- Auto-built guest profiles from every touchpoint (100+ integrations)
- Unlimited tagging + auto-tags ("positive reviewer", "steak lover", "big spender")
- 13+ pre-built automated email templates (reservation follow-up, win-back, birthday)
- Text marketing with unlimited characters + multimedia
- Review aggregation + sentiment dashboard (Google, Yelp, TripAdvisor)
- Automated referral program with perks for word-of-mouth
- VIP communication via direct SMS from the CRM

### Sprout Social (general, not restaurant-specific)
- Unified content calendar across Instagram, Facebook, TikTok, X, LinkedIn, Threads
- Optimal Send Times per profile per day
- Asset Library for pre-approved images/videos/text
- Role-based permissions + audit trail
- Team-wide visibility into scheduled content
- Analytics dashboard with engagement metrics

### Key Industry Patterns
- **AI content generation** is table stakes -- every platform now offers it
- **Triggered automations** (post-visit, win-back, birthday) outperform manual campaigns
- **Unified guest profiles** are the foundation -- marketing without CRM data is guessing
- **Review response** is increasingly automated with AI-drafted, human-approved replies
- **SMS** is growing faster than email for restaurant marketing
- **Instagram** remains the dominant social channel for restaurants in 2026

---

## 3. Target Personas

| Persona | Role | Uses Marketing Module For |
|---------|------|--------------------------|
| **Marketing Manager** | Plans weekly content, runs campaigns | Content calendar, campaign builder, analytics |
| **Owner / GM** | Approves spend, reviews performance | Dashboard KPIs, ROI tracking, review responses |
| **Social Media Coordinator** | Creates and schedules posts | Post composer, asset library, scheduling |
| **Front-of-House Manager** | Manages guest relationships | VIP tags, loyalty status, review follow-ups |

For a single-location restaurant, one person wears all four hats. The UI must collapse these workflows into a single coherent dashboard.

---

## 4. Proposed Feature Set (Prioritized)

### Phase 1 — Campaign CRUD + Calendar (MVP)
1. **Campaign create/edit/delete** from the UI (backend MCP tools already exist)
2. **Content calendar** — week/month timeline view of scheduled campaigns
3. **Campaign detail drawer** — expanded view with summary, detail points, deliverable, AI prompt
4. **Scheduled date field** on WorkspaceCampaign model
5. **Status transitions** — move campaigns through pipeline stages via drag or buttons
6. **AI draft button** — "Ask CarabinerOS" to generate campaign copy, sent as a chat message with campaign context

### Phase 2 — Content & Social
7. **Post composer** — write social media post copy with channel-specific previews (Instagram square, Facebook link card, etc.)
8. **Asset library** — upload and tag images/videos for reuse across campaigns
9. **AI content generation** — generate caption + hashtag suggestions from a menu item, event, or promotion brief
10. **Multi-channel scheduling** — set publish date/time per channel (data model only; actual posting is a Phase 3 integration)

### Phase 3 — Guest CRM + Loyalty
11. **Guest profiles** — new `WorkspaceGuest` model aggregating visit data, order history, preferences, tags
12. **Audience segments** — filter guests by visit frequency, spend, last visit, tags
13. **Loyalty program** — points-based rewards with configurable earn/redeem rules
14. **Triggered automations** — pre-built templates (welcome, win-back, birthday, post-visit)

### Phase 4 — Reviews + Analytics
15. **Review aggregation** — pull Google and Yelp reviews into a unified inbox
16. **AI review responses** — draft replies, human approves, then publish
17. **Campaign analytics** — impressions, clicks, conversions, revenue attribution
18. **Marketing dashboard** — top-line KPIs (guest acquisition cost, repeat rate, review score trend)

### Phase 5 — Integrations
19. **Social media publishing** — OAuth connection to Instagram Business, Facebook Page, TikTok Business
20. **Email/SMS delivery** — integration with SendGrid, Twilio, or Mailgun
21. **POS data sync** — pull guest transaction data from Toast/Square for CRM enrichment
22. **Review platform APIs** — Google Business Profile API, Yelp Fusion API

---

## 5. Data Model Changes

### Alter `workspace_campaigns`
```
+ scheduled_at        TIMESTAMP       -- when the campaign goes live
+ end_date            TIMESTAMP       -- campaign end (nullable, for ongoing)
+ budget_cents        INTEGER         -- budget in cents (nullable)
+ target_audience     JSONB           -- audience segment criteria
+ media_urls          JSONB           -- array of asset URLs
+ metrics             JSONB           -- impressions, clicks, conversions (updated async)
+ recurrence          VARCHAR(30)     -- 'once' | 'weekly' | 'monthly' (nullable)
+ tags                JSONB           -- freeform tags array
```

### New model: `WorkspaceMarketingPost` (Phase 2)
```
id                  UUID PK
campaign_id         UUID FK -> workspace_campaigns (nullable, can be standalone)
location_id         UUID FK -> workspace_locations
channel             VARCHAR(50)      -- instagram, facebook, tiktok, email, sms
body                TEXT             -- post copy
media_urls          JSONB            -- attached images/videos
scheduled_at        TIMESTAMP
published_at        TIMESTAMP        -- null until published
status              VARCHAR(30)      -- draft, scheduled, published, failed
external_post_id    VARCHAR(200)     -- ID from the social platform after publishing
metrics             JSONB            -- likes, comments, shares, reach
```

### New model: `WorkspaceGuest` (Phase 3)
```
id                  UUID PK
location_id         UUID FK -> workspace_locations
name                VARCHAR(200)
email               VARCHAR(200)
phone               VARCHAR(50)
visit_count         INTEGER
total_spend_cents   INTEGER
last_visit_date     DATE
loyalty_points      INTEGER
tags                JSONB            -- ["vip", "steak-lover", "birthday-march"]
source              VARCHAR(50)      -- pos, reservation, online-order, manual
notes               TEXT
```

### New model: `WorkspaceReview` (Phase 4)
```
id                  UUID PK
location_id         UUID FK -> workspace_locations
platform            VARCHAR(30)      -- google, yelp, tripadvisor
external_review_id  VARCHAR(200)
reviewer_name       VARCHAR(200)
rating              SMALLINT         -- 1-5
body                TEXT
review_date         TIMESTAMP
response            TEXT             -- our response
response_status     VARCHAR(30)      -- pending, drafted, published
sentiment           VARCHAR(20)      -- positive, neutral, negative
```

---

## 6. API Endpoints (New)

All follow existing pattern: Flask blueprint, GET-only for reads, MCP tools for writes.

### Phase 1
- `GET /api/campaigns` — already exists, add `?stage=` and `?channel=` filters
- `GET /api/campaigns/:id` — single campaign detail (new route)
- MCP tools already handle create/update/delete

### Phase 2
- `GET /api/marketing/posts` — list posts, filterable by campaign_id, channel, status
- `GET /api/marketing/posts/:id` — single post detail
- `GET /api/marketing/assets` — list uploaded media assets
- MCP tools for post CRUD

### Phase 3
- `GET /api/guests` — list guests, filterable by tags, visit_count range, spend range
- `GET /api/guests/:id` — single guest profile with history
- `GET /api/loyalty/config` — loyalty program configuration
- MCP tools for guest CRUD, loyalty config

### Phase 4
- `GET /api/reviews` — aggregated reviews, filterable by platform, rating, response_status
- `GET /api/marketing/analytics` — campaign performance summary
- MCP tools for review response drafting/publishing

---

## 7. Frontend Components (New)

### Phase 1
| Component | Description |
|-----------|-------------|
| `campaign-detail-drawer.tsx` | Slide-over showing full campaign info, edit form, stage transitions |
| `campaign-form.tsx` | Create/edit form: name, channel, stage, deliverable, scheduled date, budget |
| `content-calendar.tsx` | Week/month grid showing campaigns by scheduled_at date |
| `calendar-day-cell.tsx` | Single day in the calendar with campaign dots/pills |
| `stage-kanban.tsx` | Optional: drag-and-drop kanban board for pipeline stages |

### Phase 2
| Component | Description |
|-----------|-------------|
| `post-composer.tsx` | Write post copy, attach media, select channels, preview |
| `channel-preview.tsx` | Mock preview of how a post looks on Instagram/Facebook/etc. |
| `asset-library.tsx` | Grid of uploaded images/videos with search and tags |
| `ai-content-dialog.tsx` | Modal: describe what you want, CarabinerOS generates copy |

### Phase 3
| Component | Description |
|-----------|-------------|
| `guest-list.tsx` | Searchable, filterable table of guest profiles |
| `guest-profile-drawer.tsx` | Full guest detail: visits, orders, tags, loyalty points |
| `audience-segment-builder.tsx` | Visual filter builder for guest segments |
| `loyalty-config.tsx` | Set up points rules, rewards, tiers |

### Phase 4
| Component | Description |
|-----------|-------------|
| `review-inbox.tsx` | Unified list of reviews from all platforms |
| `review-response-card.tsx` | Single review with AI-drafted response, approve/edit/send |
| `marketing-dashboard.tsx` | KPI cards + charts: acquisition, retention, review scores |

---

## 8. AI Integration Points

CarabinerOS's differentiator: the AI is not a sidebar chatbot -- it is the system. Every feature should feel like the restaurant has a marketing coordinator on staff.

| Trigger | AI Action |
|---------|-----------|
| User clicks "New Campaign" | AI suggests campaign ideas based on upcoming events, seasonal trends, and past performance |
| User opens post composer | AI drafts channel-appropriate copy from a brief ("Promote our new spring menu") |
| New review arrives (negative) | AI drafts a response, surfaces as an action card for approval |
| Campaign goes Live | AI generates a summary action card with predicted reach |
| Guest hasn't visited in 30 days | AI triggers a win-back campaign suggestion (action card) |
| Weekly Monday morning | AI generates a "This Week in Marketing" briefing action card with scheduled posts, review scores, and loyalty stats |
| Menu item changes | AI suggests updating related campaigns and social content |

All AI interactions flow through the existing chat + action card system. The marketing module does not need its own AI interface.

---

## 9. Migration Path

**Migration 1 (Phase 1):** Alter `workspace_campaigns` -- add `scheduled_at`, `end_date`, `budget_cents`, `target_audience`, `media_urls`, `metrics`, `recurrence`, `tags` columns. All nullable so existing data is unaffected.

**Migration 2 (Phase 2):** Create `workspace_marketing_posts` table. Create `workspace_media_assets` table.

**Migration 3 (Phase 3):** Create `workspace_guests` table. Create `workspace_loyalty_config` table.

**Migration 4 (Phase 4):** Create `workspace_reviews` table.

Each migration is independent and can ship with its corresponding phase.

---

## 10. Implementation Phases (Revised — Chef-Approved)

> **Design principle:** Chat-first. The marketing page is where A0's suggestions land and where you approve them. The AI IS the marketing coordinator — it knows your menu, watches competitors, tracks trends, and drafts everything. You just say yes or no.
>
> **Real-world context:** Alinea Group has a dedicated marketing team (photos, video, email campaigns, etc.). Chef Grant posts stories personally. Most restaurants? The chef-owner does it at 11pm after service. CarabinerOS makes that 11pm moment take 30 seconds.
>
> **Marketing Agent vision:** A dedicated A0 agent profile that:
> 1. Knows your restaurant (menu, price points, cuisine, neighborhood, brand voice)
> 2. Watches competition (what are nearby restaurants posting? what's working?)
> 3. Tracks viral trends (food trends on Instagram/TikTok, seasonal moments)
> 4. Suggests proactive content as action cards ("Your competitor just posted a spring menu. Here's a better version.")
> 5. Drafts everything — captions, emails, hashtags, posting schedule
>
> **Rune skills to learn from:** `rune:marketing` (asset creation, launch strategy) and `rune:trend-scout` (market trends, competitor activity, social scanning). Both exist and can inform the marketing agent's behavior.

### Phase 1: Campaign CRUD + Calendar + Chat (P0)
1. DB migration: add `scheduled_at`, `end_date`, `budget_cents`, `media_urls`, `tags` to `workspace_campaigns`
2. Campaign list — functional create/edit/delete (MCP tools already exist, wire to UI)
3. Campaign detail slide-over with **chat at bottom**:
   - "Write an Instagram caption for our new lamb dish"
   - "Schedule this for Friday at 5pm"
   - "Move to live"
   - A0 drafts copy, hashtags, posting time. Shows as card you approve.
4. Content calendar — simple week view showing scheduled campaigns by date
5. "New Campaign" button → opens chat: "What should I post this week?" A0 suggests based on menu, inventory, trends
6. Stage transitions via chat: "move the lamb post to live", "archive last week's campaigns"

### Phase 2: Marketing Agent Intelligence (P1)
7. **Competition watching** — A0 marketing agent uses browser tool to research:
   - What nearby restaurants are posting on Instagram
   - What food content is trending on TikTok/Instagram
   - Seasonal ingredient trends, cultural moments, food holidays
   - Competitor pricing, new menu items, events
8. **Proactive suggestions as action cards:**
   - "National Taco Day is next Tuesday — want me to draft a special?"
   - "3 restaurants in your area posted spring menus this week. Here's yours."
   - "Your lamb dish is a Star — let's promote it. Here's a draft caption."
   - "Your competitor raised burger prices to $24. Yours is $19 — opportunity to highlight value."
9. **Restaurant profile** — A0 builds understanding through conversation: cuisine, brand voice, target audience, social handles. Stored for consistent content tone.

### Phase 3: Content Creation + Delivery (P2)
10. Post composer with channel previews (Instagram/Facebook/TikTok mockups)
11. AI content generation — caption + hashtags + suggested photo direction from a brief
12. Asset library — uploaded images/videos for reuse
13. Social publishing OAuth (Instagram Business, Facebook Page) — A0 posts directly

### Deferred — Future
- Guest CRM / loyalty program — entire separate system
- Email/SMS campaigns — needs SendGrid/Twilio integration
- Review aggregation + AI responses — needs Google/Yelp API
- Campaign analytics — needs publishing integration for impression data
- A/B testing — future

---

## Competitive Positioning

CarabinerOS does not need to replicate Sprout Social or SevenRooms from day one. The wedge is:

1. **AI-native campaign creation** — "plan next week's social content around our new spring menu" → full content calendar back
2. **Proactive trend intelligence** — A0 watches competitors and trends, suggests content before you think to ask
3. **Action-card workflow** — suggestions arrive as cards you approve or dismiss, not dashboards you forget to check
4. **Unified with operations** — marketing knows about inventory (don't promote sold-out items), menu (promote Stars), food cost (push high-margin dishes), prep (new dish ready → auto-suggest content)

The marketing module should feel like having a sharp marketing coordinator who also reads the P&L, checks the walk-in, and scrolls Instagram at midnight so you don't have to.
