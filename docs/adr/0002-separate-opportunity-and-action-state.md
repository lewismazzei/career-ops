# ADR 0002: Separate opportunity state from action state

## Status

Accepted as a starting point

## Context

The original Scythe tracker uses fields such as `Status`, `Outcome`, and `Next Action`. That is enough for a first Markdown tracker, but it mixes two different questions:

- Where is this opportunity in the lifecycle?
- What should the operator do next?

Scythe needs an action model for Codex-driven work and an observability model for the GUI. That requires a clearer process model.

## Decision

Scythe will separate opportunity state from action state.

The initial opportunity states are `inbox`, `inspect`, `qualified`, `active`, `waiting`, `saved`, `archived`, and `converted`.

The initial action types are `inspect`, `position`, `apply`, `draft-outreach`, `send-follow-up`, `prepare-call`, `save`, and `archive`.

The initial action states are `ready`, `blocked`, `drafted`, `sent`, `done`, and `skipped`.

This is a starting model. It should be revised after the operator has worked through real items and found where the vocabulary fails.

## Consequences

Codex should primarily reason about actions, with opportunities as context.

The full opportunity lifecycle should remain observable in the GUI.

Existing Markdown tracker fields can continue to exist during the pilot, but future UI and data model changes should avoid treating one `status` field as both lifecycle state and next-action state.
