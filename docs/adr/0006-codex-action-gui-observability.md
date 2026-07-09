# ADR 0006: Codex is the action interface and the GUI is the observability interface

## Status

Accepted

## Context

Earlier decisions treated the Scythe browser UI as the primary action cockpit. That was misleading. The operator's primary interface for acting on Scythe is Codex: inspecting opportunities, reasoning about fit, choosing positioning, drafting applications or outreach, preparing for calls, and updating trackers.

The GUI is still useful, but for a different job: observing the state of information Scythe has collected and inferred.

## Decision

Codex is the primary action interface.

The GUI is the observability interface.

The GUI should show collected opportunities, saved items, statuses, outcomes, classifications, freshness, and debugging/detail views in a terse form. It should not try to become the place where the operator performs the core work.

The action model still matters, but it is primarily for Codex working sessions and state transitions, not for turning the browser home page into a task app.

The GUI's primary question is: "what does Scythe currently know?" Codex's primary question is: "what should we do next?"

The GUI should optimize for inventory, state, freshness, exceptions, and drill-down. It should not optimize for action buttons, writing or drafting surfaces, complex workflow controls, or prose-heavy explanations on main screens.

The GUI should treat base Pixel 10 portrait as a first-class target. The working layout target is `360 x 732` CSS pixels at DPR 3, corresponding to Google's 1080 x 2424, 20:9 Pixel 10 display specification. Core observability views should stay legible without horizontal scrolling at that width.

The minimum GUI page set is:

- `Overview` - terse system snapshot and exceptions.
- `Opportunities` - full collected opportunity inventory.
- `Saved` - deferred or future-use signals.
- `State` - counts, freshness, source/status/outcome distribution.
- `Item detail` - later, for one record's raw source, notes, history, and generated artifacts.

Analytics, pipeline-board, calendar, CRM, or similar dashboard surfaces should not be added until real usage proves they are needed.

## Consequences

The GUI home page should be state-first rather than action-first.

Navigation should favor overview, opportunities, saved items, and state inspection.

Action labels and next steps can appear as observable fields, but should not be presented as the main interaction model.

ADRs 0001 and 0003 are superseded where they imply the landing view is an action-biased cockpit.
