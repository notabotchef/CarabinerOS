"""Chef-flavor filler pool — Python mirror of the frontend's THINKING_MESSAGES.

The CarabinerOS chat UI renders agent tool-call progress as an
``InlineTicket`` (a collapsible step list above the assistant message).
Filler steps (e.g. "still working", "looking up data") are rendered in
italic primary-color text using strings from this pool. The frontend
list lives at ``frontend/src/hooks/use-chat.ts:18``; keep both lists
in sync so agent-emitted step headings line up with the recognized
filler set.

The pool is sampled deterministically per MCP tool invocation so the
operator sees a stable "what I'm doing" trace per turn. Each entry
pairs with one of the MCP module families (orders, prep, inventory,
invoices, food_cost, menu, recipes, marketing) so a flavor hints at
what the agent is doing without leaking the literal tool name.

See also:
  - frontend/src/hooks/use-chat.ts: ``THINKING_MESSAGES`` constant
  - frontend/src/components/message-list.tsx: ``InlineTicket`` renderer
  - carabiner/runtime/http_api.py: ``_assistant_run`` (this module's consumer)
"""

from __future__ import annotations

import hashlib
from typing import Iterable, Optional

# Order matters: pool is sampled by index, so adding entries at the end
# is safe but reordering is not (changes which flavor shows for which
# tool family in an existing session).
CHEF_FLAVORS: tuple[str, ...] = (
    # --- OG 8 (matched against frontend's "OG 8" group) ---
    "Checking if Rene Redzepi already paid the interns",
    "Cross-referencing your wine list with last night's dreams",
    "Consulting the mise en place oracle",
    "Running the numbers through the pasta machine",
    "Asking the walk-in for its opinion",
    "Debating butter quantities with the saucier",
    "Checking the reservation book for ghosts",
    "Calibrating the flavor compass",
    # --- The line ---
    "Counting how many side towels disappeared this shift",
    "Asking the dishwasher if they've seen your will to live",
    "Waiting for the ticket printer to stop — just kidding, it never stops",
    "Checking if the walk-in is still judging us",
    "Consulting the ancient texts (the binder behind the bar)",
    "Whispering “heard” to no one in particular",
    "Doing a quick cry in the walk-in, one sec",
    "Blaming the previous shift",
    "Rewriting the 86 list for the third time today",
    "Pretending this ticket didn't just print",
    "Negotiating with the salamander",
    "Double-checking that nobody 86'd the good tongs",
    "Asking the line if they're in the weeds or just standing there",
    "Looking for the sharpie someone definitely borrowed",
    "Reading the ticket printer like it's a fortune teller",
    "Confirming the special is still special",
    "Checking who left the burner on overnight",
    "Performing a quick inventory of lost Sharpies",
    "Convincing the garde manger this is important",
    "Wondering who labeled this container “stuff”",
    "Ignoring the front-of-house like a true line cook",
    "Telling the new guy to check the basement",
    "Looking for a clean apron (good luck)",
    "Calculating how many covers before we lose it",
    "Verifying the fish delivery wasn't yesterday's fish",
    "Staring at the board like it owes us money",
    "Asking Chef if we can sub micro-greens for personality",
    "Rotating stock and existential dread",
    "Checking if that's a fruit fly or a garnish",
    "Reviewing the Bourdain playbook",
    "Confirming the quenelles pass the vibe check",
    "Making sure the pass is clear before we fire",
    "Trying to remember who has the keys to dry storage",
    "Tempering chocolate and expectations",
)


def sample(context_id: str, *, salt: Optional[str] = None) -> str:
    """Pick a stable chef-flavor string for the given context.

    The choice is deterministic per ``(context_id, salt)`` so a single
    conversation emits the same flavor repeatedly when the agent calls
    the same tool family twice in a row — operators see continuity,
    not a new joke per step. Pass ``salt`` to nudge the choice
    (e.g. one per tool-call index).

    Parameters
    ----------
    context_id
        The chat context id; keeps the flavor stable for the
        duration of one conversation.
    salt
        Optional disambiguator — typically the module name or tool
        call counter — so different tools in the same turn can show
        different flavors.
    """
    key = f"{context_id}|{salt or ''}".encode("utf-8")
    digest = hashlib.sha1(key).digest()
    idx = int.from_bytes(digest[:4], "big") % len(CHEF_FLAVORS)
    return CHEF_FLAVORS[idx]


def is_known_filler(heading: str) -> bool:
    """Return True if ``heading`` is one of the recognized filler strings.

    Used by tests to verify the agent's emitted headings match the
    pool — anything not in the pool renders as a bold step instead of
    italic filler in the InlineTicket.
    """
    return heading in CHEF_FLAVORS


__all__ = ["CHEF_FLAVORS", "sample", "is_known_filler"]