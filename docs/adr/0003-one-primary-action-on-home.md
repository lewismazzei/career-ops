# ADR 0003: Show one primary action per opportunity on the landing view

## Status

Superseded by ADR 0006

## Context

An opportunity can require several actions: inspect the source, prepare positioning, draft an application, follow up, save, or archive. Showing every possible action on the landing view would make the home page a planning surface rather than an execution surface.

## Decision

Scythe may represent many actions per opportunity in the underlying model.

The landing view should show at most one primary action per opportunity.

Detail and observability views may show secondary actions, action history, raw notes, and state transitions.

## Consequences

The home page stays action-biased and compact.

Scythe needs a rule for selecting the primary action when multiple actions exist for one opportunity.
