---
name: carabineros-location-context
description: "Location-aware context for CarabinerOS — which location the operator is looking at, how to scope reads and proposals, and the rule against any hard-coded location label."
version: 1.0.0
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [restaurant, carabineros, locations, scoping, context]
    related_skills:
      - carabineros-restaurant
---

# CarabinerOS Location Context

This skill teaches the model **how to think about locations** without
hard-coding any specific one. The prior overlay defaulted to a
placeholder string when no location was given — that approach is
gone. Location context must come from data, not from a prompt
constant.

## The rule

There is no default location in this skill. There is no default
location in `SOUL.md`. There is no default location anywhere.

If the operator does not specify a location, the model must ask.
There is exactly one acceptable prompt:

> *"Which location should I look at?"*

…followed by listing the names pulled from `carabiner_read("…")` when
the skill's read helper is available, or from the location registry
otherwise.

The prior overlay defaulted to a placeholder string when no location
was given. That approach is gone: location context must come from
data, not from a prompt constant.

## How locations enter the conversation

Locations enter in **one of three** ways, all of them operator-driven:

1. **Operator says it in chat.** e.g. *"How are POs looking at River
   North?"* The model uses that location's id from the database; it
   does not invent one.
2. **Frontend sets the active location.** The CarabinerOS dashboard
   has an active-location selector. The bridge passes that id into
   the chat request as `active_location_id`. The model reads it from
   context; it does not assume it.
3. **Model asks.** When neither of the above holds, the model asks.
   It does not pick a default.

## Reading data with location scope

When the operator or dashboard specifies a location, scope reads to
that location id:

```
carabiner_read("orders", filters='{"location_id": "<uuid>"}')
carabiner_read("inventory", filters='{"location_id": "<uuid>"}')
carabiner_read("prep", filters='{"location_id": "<uuid>"}')
```

When the operator explicitly asks for **all** locations, omit the
filter and the bridge will return everything (subject to the
read endpoint's normal pagination).

## Writing with location scope

Every `carabiner_propose_write(…)` call on a `create` verb **must**
include `location_id` in `data`. The host-side policy gate in
`carabiner/runtime/policy.py` enforces this; proposals without a
`location_id` are denied before they reach the audit log.

For `update` and `delete`, `location_id` is **not** required in `data`
(the affected record's id is enough for policy to scope the change),
but it is still helpful to include in `reason` so the operator's
action card shows the location context.

## What this skill explicitly does

- Documents the three operator-driven paths for location context.
- Documents how to scope reads and writes by `location_id`.
- Names the locations that *exist* in the system only when the model
  is responding to a read that returned them — never in a system
  prompt, never as a default.

## What this skill is not

- It is not a hard-coded location list. There are no fixed names here.
- It is not a default-location enforcer. The bridge does not pick a
  default; the model asks if none is provided.
- It is not a substitute for `carabineros-restaurant`. Read the
  restaurant skill first for the data-access rules; this skill adds
  the location scoping on top.