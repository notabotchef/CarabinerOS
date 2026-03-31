# NotebookLM MCP Integration Checklist for Carabiner OS

## Quick Facts

| Aspect | Value |
|--------|-------|
| **Tech Stack** | TypeScript, Node.js 18+, Patchright 1.48.2 (Chromium automation) |
| **Authentication** | Browser-based Google OAuth → persistent cookies (24h TTL) |
| **Connection Method** | Headless Chromium web scraping (NO API, DOM-based) |
| **Rate Limit** | 50 queries/day free, 250 Pro, 500 Ultra |
| **Setup Time** | ~5 minutes (one manual Google login) |
| **Security Profile** | Local browser automation; use dedicated Google account |
| **Use Case Fit** | Internal documentation, API references, knowledge bases |

---

## Why NotebookLM for Carabiner OS?

### ✅ Perfect Use Cases
1. **Restaurant Operation Playbooks** - Upload SOPs, capture all edge cases
2. **Supplier Integration Docs** - Toast, OpenTable, Square API guides
3. **Kitchen Workflow Reference** - Prep lists, timing protocols, ingredient specs
4. **Cost Analysis Historical Data** - Past invoices, trend analysis
5. **Regulatory Compliance** - Food safety, labor law, tax documentation

### ❌ Not Ideal For
- Real-time data (order queue, inventory levels)
- Data that changes multiple times per hour
- Large image/video processing (NotebookLM weak here)
- Live API responses

---

## Technical Integration Points

### Current Carabiner Stack vs. NotebookLM Requirements

**Frontend**: Next.js 16 + React 19 + TypeScript
- ✅ Can call NotebookLM MCP tools via backend
- ✅ Display results as cards/panels in restaurant modules

**Backend**: Python/Flask + Socket.IO + SQLAlchemy
- ✅ NotebookLM MCP is Node.js, but can be:
  - Spawned as separate service (recommended)
  - Called via subprocess/shell
  - Exposed via its own port/socket

**Database**: PostgreSQL 16
- ✅ Query context can be prepended to questions (your context piggybacking pattern!)
- Example: Ask NotebookLM with [current_inventory, recent_invoices] context

**Recommended Architecture**:
```
Carabiner Frontend
  ↓
Carabiner Backend (Python/Flask)
  ↓
NotebookLM MCP Service (Node.js, separate process)
  ↓
Patchright/Chromium
  ↓
Google NotebookLM
```

---

## Implementation Phases

### Phase 0: Proof of Concept (2-3 hours)
1. **Install locally**: `claude mcp add notebooklm npx notebooklm-mcp@latest`
2. **Manual setup**: Log in to NotebookLM, create test notebook
3. **Test in Claude Code**: Ask questions via the `ask_question` tool
4. **Document findings**: Integration blockers, latency, reliability

**Success criteria**: Can ask NotebookLM 5+ questions reliably

### Phase 1: Integration (1-2 days)
1. **Add NotebookLM config** to `usr/settings.json`
   - `notebook_url`: Link to shared Carabiner OS docs notebook
   - `mcp_profile`: "standard" (includes `add_notebook`, `select_notebook`)
2. **Create Carabiner module**: `frontend/src/app/knowledge/`
   - Page for listing available notebooks
   - Chat interface for asking questions
   - Results displayed as info cards
3. **Backend routing**: Add Flask blueprint to pipe questions to MCP
   - `POST /api/knowledge/ask` → calls NotebookLM MCP → returns answer
4. **Socket.IO support**: Stream long responses in real-time

### Phase 2: Multi-Notebook Library (3-5 days)
1. **Expand notebook library**:
   - Supplier integrations (Toast, OpenTable)
   - Food cost analytics protocols
   - Compliance documentation
   - Kitchen SOPs
2. **Smart selection**: Claude auto-chooses relevant notebook based on context
3. **Tag system**: Users can tag notebooks (`frontend`, `supplier-toast`, `compliance`)
4. **Search**: `search_notebooks` tool to find by keyword

### Phase 3: Context Piggybacking (1-2 days)
1. **Query preparation**: Before asking NotebookLM, fetch context
   - Current inventory state
   - Recent invoices
   - Active orders (if applicable)
2. **Format as prompt prefix**:
   ```
   [Current Inventory: rice 50kg, flour 25kg, ...]
   [Last Invoice Total: $2,450, Date: 2025-03-27]
   [Question]: How should we adjust rice ordering based on trend?
   ```
3. **NotebookLM context**: Provides knowledge base + fresh operational context

### Phase 4: Operational Integration (2-3 days)
1. **Action cards**: NotebookLM answers trigger action cards
   - "Adjust supplier order" → order management card
   - "Update cost category" → invoice adjustment card
2. **Batch research**: Claude chains questions before implementing
   - Q1: "What's best practice for X?"
   - Q2: "Edge cases for X?"
   - Q3: "How to handle Y?"
   - Result: Implementation plan

---

## Migration Path: From Manual Lookups to Automated

### Today (Without NotebookLM)
```
Chef: "How do I reduce food cost?"
↓
Manual: Search Docs, Slack, Email
↓
Result: Outdated info, no synthesis
```

### Phase 1: Manual Queries (Week 1)
```
Chef: "How do I reduce food cost?" (in Carabiner chat)
↓
Claude: Queries NotebookLM notebook
↓
Result: "Based on your playbook: A, B, C"
```

### Phase 2: Context-Aware (Week 2-3)
```
Chef: "Why is our cost trending up?"
↓
Claude: Fetches [recent_invoices, inventory, targets]
↓
Queries NotebookLM: "Given this context, what's wrong?"
↓
Result: "Your supplier X pricing increased 12%. Options: switch, negotiate, adjust menu"
```

### Phase 3: Autonomous (Week 4+)
```
Daily Monitor: Cost variance > threshold
↓
Auto-trigger: "Analyze why cost is X% above target"
↓
NotebookLM: Synthesizes invoice history + playbook
↓
Action Card: "Negotiate with supplier X for volume discount"
↓
Chef: Reviews & approves
```

---

## Blockers & Mitigations

| Blocker | Impact | Mitigation |
|---------|--------|-----------|
| **50 query/day limit** | Free tier exhaustion | Upgrade to AI Pro ($50/mo); cache answers |
| **Google account needed** | Account management | Use restaurant's Google account; 2FA OK |
| **24h auth expiry** | Session refresh required | Automate `setup_auth` in monitoring job; refresh daily |
| **Browser automation detection** | Google blocking bot | Use stealth mode; stay within rate limits; dedicated account |
| **Latency** | 2-5s per query (browser startup overhead) | Keep session alive; cache between queries |
| **Notebook URL sharing** | Access control | NotebookLM link-sharing only (no fine-grained auth) |
| **Node.js separate service** | Process management | Docker sidecar; systemd service; PM2 cluster mode |

---

## Docker Deployment

### Option 1: Sidecar Container (Recommended)
```yaml
version: '3.8'
services:
  carabiner-backend:
    image: carabiner-backend:latest
    depends_on:
      - notebooklm-mcp

  notebooklm-mcp:
    image: notebooklm-mcp:latest
    environment:
      - HEADLESS=true
      - SESSION_TIMEOUT=900
      - NOTEBOOKLM_PROFILE=standard
    volumes:
      - notebooklm-data:/root/.local/share/notebooklm-mcp
      - notebooklm-config:/root/.config/notebooklm-mcp
    ports:
      - "3001:3001"  # Expose MCP stdio port
```

### Option 2: Python Subprocess
```python
# In Carabiner Flask backend
import subprocess
import json

result = subprocess.run(
    ["npx", "notebooklm-mcp"],
    input=json.dumps({"tool": "ask_question", "question": "..."}),
    capture_output=True,
    text=True
)
answer = json.loads(result.stdout)
```

---

## Configuration for Carabiner OS

### Settings to Add to `usr/settings.json`

```json
{
  "notebooklm": {
    "enabled": true,
    "profile": "standard",
    "notebooks": {
      "operations": {
        "url": "https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID",
        "name": "Restaurant Operations",
        "tags": ["sop", "kitchen", "front-of-house"],
        "description": "Standard operating procedures, timing protocols, safety guidelines"
      },
      "suppliers": {
        "url": "https://notebooklm.google.com/notebook/YOUR_SUPPLIER_NOTEBOOK_ID",
        "name": "Supplier Integration",
        "tags": ["toast", "openable", "square", "7shifts"],
        "description": "API docs and integration guides for Toast, OpenTable, Square, 7shifts"
      },
      "compliance": {
        "url": "https://notebooklm.google.com/notebook/YOUR_COMPLIANCE_ID",
        "name": "Compliance & Regulations",
        "tags": ["food-safety", "labor", "health"],
        "description": "Food safety codes, labor laws, health department requirements"
      }
    },
    "features": {
      "auto_select_notebook": true,
      "context_piggybacking": true,
      "cache_answers": true,
      "cache_ttl_seconds": 3600
    }
  }
}
```

### Environment Variables (Docker/Production)

```bash
# Docker container startup
NOTEBOOKLM_PROFILE=standard
NOTEBOOKLM_HEADLESS=true
SESSION_TIMEOUT=900
STEALTH_ENABLED=true

# Optional: Auto-login (⚠️ use dedicated account)
AUTO_LOGIN_ENABLED=false
LOGIN_EMAIL=notebooklm@restaurant.com
LOGIN_PASSWORD=secure_password_here
```

---

## Monitoring & Health Checks

### Health Check Endpoint (Add to Backend)
```python
@app.route('/api/knowledge/health')
async def knowledge_health():
    """Check NotebookLM MCP server health"""
    result = await call_mcp_tool("get_health")
    return {
        "mcp_running": result.get("success"),
        "auth_valid": result.get("auth_valid"),
        "rate_limit": result.get("remaining_queries"),
        "last_query": result.get("last_query_time")
    }
```

### Daily Tasks
1. **Check auth expiry**: If state > 20h old, run `setup_auth`
2. **Monitor query count**: Alert if approaching 50/day
3. **Test notebook access**: Sample query every 4 hours

---

## Testing Strategy

### Unit Tests (Python Backend)
```python
@pytest.mark.asyncio
async def test_notebooklm_ask_question():
    """Test NotebookLM integration"""
    result = await call_mcp_tool("ask_question", {
        "question": "What are safety protocols?",
        "notebook_url": "https://notebooklm.google.com/notebook/test"
    })
    assert result.get("success")
    assert len(result.get("answer", "")) > 10

@pytest.mark.asyncio
async def test_notebooklm_rate_limit():
    """Test handling of rate limit error"""
    # Simulate 51 queries (exceed limit)
    for i in range(51):
        result = await call_mcp_tool("ask_question", ...)
    assert result.get("error") == "Rate limit reached"
```

### Integration Tests (E2E)
1. Setup: Create test NotebookLM notebook
2. Add to library: `add_notebook` tool
3. Query: `ask_question` with sample questions
4. Verify: Answer contains expected keywords
5. Cleanup: `remove_notebook` tool

---

## Quick Start Script

```bash
#!/bin/bash
# setup-notebooklm.sh

echo "Installing NotebookLM MCP..."
npm install -g notebooklm-mcp

echo "Starting interactive setup..."
npx notebooklm-mcp &
NOTEBOOKLM_PID=$!

echo ""
echo "Step 1: A Chrome window should open. Log in with your Google account."
echo "Step 2: After login, close the browser window."
echo ""
read -p "Press Enter after login..."

echo ""
echo "Step 3: Create a notebook at https://notebooklm.google.com"
echo "        Upload your restaurant operation docs (SOPs, recipes, etc)"
echo "        Share with 'Anyone with link'"
echo ""
read -p "Enter your NotebookLM URL: " NOTEBOOK_URL

# Test the connection
echo "Testing connection..."
npx notebooklm-mcp config set --notebook-url "$NOTEBOOK_URL"

echo "✅ Setup complete! You can now use NotebookLM in Carabiner OS."
```

---

## Cost Analysis

### Free Tier (50 queries/day)
- **Cost**: $0
- **Use case**: Development, testing, light usage (< 50 Q/day)
- **Recommendation**: Fine for MVP

### Google AI Pro ($50/month)
- **Queries/day**: 250
- **Cost per query**: $0.20
- **Use case**: Production small restaurant (50-100 Q/day safe buffer)
- **Recommendation**: Good ROI if used 5+ days/week

### Google AI Ultra ($500/month)
- **Queries/day**: 500
- **Cost per query**: $0.033
- **Use case**: Chain restaurants, high-volume research
- **Recommendation**: Overkill unless scaling to 10+ locations

---

## Success Metrics (Post-Launch)

Track in Carabiner dashboard:
1. **Adoption**: % of sessions using Knowledge module
2. **Query volume**: Queries/day per restaurant
3. **Quality**: Answer relevance score (1-5 from user)
4. **Latency**: Time from question to answer
5. **Cost**: Total queries/day vs. Google tier
6. **Reliability**: Uptime, auth failures, timeouts

---

## Next Steps

1. **Immediate**: Read full research document (`NOTEBOOKLM_CONNECTION_RESEARCH.md`)
2. **This week**: PoC setup + first NotebookLM query
3. **Next week**: Design frontend Knowledge module
4. **Then**: Integrate with Carabiner backend + Socket.IO streaming
5. **Polish**: Add context piggybacking, caching, monitoring

---

## Resources

- **GitHub**: https://github.com/PleasePrompto/notebooklm-mcp
- **Full Research**: `NOTEBOOKLM_CONNECTION_RESEARCH.md`
- **NotebookLM**: https://notebooklm.google.com
- **MCP Docs**: https://modelcontextprotocol.io
