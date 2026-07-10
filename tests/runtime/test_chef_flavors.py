"""Hermetic tests for the chef-flavor filler pool.

The frontend's ``InlineTicket`` recognizes filler steps by matching the
emitted heading against ``THINKING_MESSAGES`` in
``frontend/src/hooks/use-chat.ts:18``. The Python bridge mirrors that
list in ``carabiner/runtime/chef_flavors.py`` and samples from it to
emit an opener step at the start of each assistant turn. Both lists
must stay in lock-step or filler steps render as bold (non-filler) in
the UI.

These tests guard the invariant and verify the sampler is deterministic
per (context, salt) pair.
"""

from __future__ import annotations

from carabiner.runtime import chef_flavors


def test_pool_is_nonempty_and_distinct() -> None:
    """The pool must have at least one entry and no duplicates."""
    assert len(chef_flavors.CHEF_FLAVORS) > 0
    assert len(chef_flavors.CHEF_FLAVORS) == len(set(chef_flavors.CHEF_FLAVORS))


def test_sample_is_deterministic_per_context() -> None:
    """Same context + salt must yield the same flavor across calls."""
    a = chef_flavors.sample("ctx-1", salt="turn:123")
    b = chef_flavors.sample("ctx-1", salt="turn:123")
    assert a == b


def test_sample_varies_across_contexts() -> None:
    """Different contexts should usually pick different flavors."""
    # 8 contexts into a pool of 40+ entries: with high probability at
    # least two will differ. If this ever flakes, expand the pool.
    picks = {chef_flavors.sample(f"ctx-{i}", salt="x") for i in range(8)}
    assert len(picks) > 1


def test_sample_varies_across_salts() -> None:
    """Different salts within the same context should usually differ."""
    picks = {
        chef_flavors.sample("ctx-fixed", salt=f"turn:{i}") for i in range(8)
    }
    assert len(picks) > 1


def test_sample_returns_known_filler() -> None:
    """The sampled heading must be a recognized filler string."""
    picked = chef_flavors.sample("any-ctx", salt="any-salt")
    assert chef_flavors.is_known_filler(picked)


def test_is_known_filler_rejects_arbitrary_text() -> None:
    """Random prose is NOT a filler — that would render as a bold step."""
    assert not chef_flavors.is_known_filler("Plain answer text")
    assert not chef_flavors.is_known_filler("Sales are $12,400 today.")
    assert chef_flavors.is_known_filler(chef_flavors.CHEF_FLAVORS[0])


def test_pool_includes_frontend_known_strings() -> None:
    """The two lists must overlap on at least the canonical "OG 8" set.

    If the frontend list grows or shrinks but the Python mirror
    doesn't, the InlineTicket's italic-filler rendering breaks. This
    test only checks the small invariant set; full sync verification
    is a maintenance task, not a unit test.
    """
    canonical = (
        "Checking if Rene Redzepi already paid the interns",
        "Cross-referencing your wine list with last night's dreams",
        "Consulting the mise en place oracle",
        "Running the numbers through the pasta machine",
        "Asking the walk-in for its opinion",
        "Debating butter quantities with the saucier",
        "Checking the reservation book for ghosts",
        "Calibrating the flavor compass",
    )
    for heading in canonical:
        assert chef_flavors.is_known_filler(heading), (
            f"missing canonical filler: {heading!r} — "
            "sync frontend/src/hooks/use-chat.ts THINKING_MESSAGES "
            "with carabiner/runtime/chef_flavors.py CHEF_FLAVORS"
        )