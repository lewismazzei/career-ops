# ADR 0004: Use a lightweight inspect-to-conversation process

## Status

Accepted as a starting point

## Context

Scythe needs a default process that turns collected items into paid-work conversations without overplanning. The user wants to be paid as soon as possible, but also wants to avoid blindly applying or overclaiming fit.

## Decision

The initial lifecycle sequence is:

1. `inbox` + `inspect` - confirm the source is live, remote-compatible, and not obviously irrelevant.
2. `inspect` + `position` - decide whether there is a credible angle and what the main risk or claim is.
3. `qualified` + `apply` or `draft-outreach` - produce the artifact that can start a paid-work conversation.
4. `active` + `prepare-call` - prepare only when screening, interview, or client-call risk justifies it.
5. `waiting` + `send-follow-up` - after applying, contacting, or sending, track the next due follow-up.
6. `saved`, `archived`, or `converted` - exit active attention.

Scythe should not normally push an item directly to `apply` or `draft-outreach` until it has passed `inspect` and `position`, unless the opportunity is trivially obvious.

## Consequences

The queue needs enough state to distinguish uninspected items from positioned items.

The application/outreach surfaces should preserve the positioning decision that made the item worth pursuing.

The model is intentionally lightweight and should be revised after real queue work exposes missing states or actions.
