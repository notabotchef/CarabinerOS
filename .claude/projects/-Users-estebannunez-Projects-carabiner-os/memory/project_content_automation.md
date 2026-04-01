---
name: Content Automation Pipeline
description: Automated X/threads posts from NotebookLM book collection — 5 daily posts (recipe, food science, flavor combo, technique, random fact) with Obsidian archival
type: project
---

**Goal:** Automate 5 daily X posts + threads sourced from Esteban's NotebookLM book collection.

**Daily content schedule:**
1. 1 recipe (from cookbook collection)
2. 1 food science fact (from food science books)
3. 1 crazy flavor combination (from flavor pairing references)
4. 1 technique (from culinary technique books)
5. 1 random food fact (from any source)

**Architecture:**
- **Source:** NotebookLM MCP → extract content from book collection
- **Generation:** A0 scheduled task (cron) → generates 5 posts daily
- **Images:** A0 already has a schedule-based image generation attempt (prior work exists, can be hooked up)
- **Publishing:** Post to X/Threads via API or browser automation
- **Archival:** Save all generated content to Obsidian vault (last30days style)
- **Analytics feedback:** Track engagement → feed back into content selection (OpenClaw content system pattern)

**Prior work:** Esteban previously tried auto-generating pictures using A0 schedule. That pipeline can be reused/extended.

**Build order:**
1. First: set up last30days automated R&D discovery
2. Then: wire NotebookLM MCP → content generation → X posting → Obsidian archival
3. Then: hook up image generation from prior A0 schedule work

**How to apply:** This is post-R&D-automation work. Don't start until last30days pipeline is running. Follows the same pattern as OpenClaw's content system (idea capture → planning → generation → posting → analytics → feedback loop).
