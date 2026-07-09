# ADR 0001: Scythe is a private operator cockpit

## Status

Superseded by ADR 0006

## Context

The Scythe pilot began from Career-Ops but is not trying to preserve the legacy application's broad feature surface. The immediate goal is remote paid-work acquisition, with the first screen helping the operator decide what to do next.

At the same time, Scythe collects and classifies information across scans, opportunities, saved items, statuses, notes, and outcomes. The operator needs complete observability into that information, but not all of it should compete for attention on the landing view.

## Decision

Scythe will be treated as a private operator cockpit.

The landing view will prioritize the next best action and the most active items. Its primary unit is an action, with the opportunity as context. Observability into the complete collected state will live in deeper pages or inspection views.

Observability surfaces will be terse by default. They should expose state, source, classification, and freshness with compact labels or tables, not prose-heavy explanations. Detail belongs behind drill-in views.

## Consequences

The UI should stay compact, operational, and action-biased.

Legacy Career-Ops dashboard features should not be carried into Scythe unless they directly support paid-work conversion or state inspection.

State, saved items, scan outputs, classifications, and debugging information are valid Scythe surfaces, but they should not dominate the default view unless they are needed for the next action.

Verbose notes and generated artifacts can still exist, but the primary UI should not force the operator to read them while scanning the queue.
