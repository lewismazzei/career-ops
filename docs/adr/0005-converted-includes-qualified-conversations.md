# ADR 0005: Converted includes qualified paid-work conversations

## Status

Accepted

## Context

Scythe's real objective is signed paid work, but waiting until payment to mark conversion would hide the first useful feedback loop. The pilot success metric already includes qualified conversations as the first signal that the system is working.

## Decision

An opportunity can enter `converted` when it produces either:

- a qualified paid-work conversation, or
- paid work.

The outcome distinguishes the level reached:

- `conversation` means a real person with authority or influence is engaged around plausible paid work and there is a concrete next step.
- `paid` means money is agreed, invoiced, paid, or contractually committed.

## Consequences

The UI and reports should avoid implying that every conversion is revenue.

Scythe can learn from qualified conversations before cash lands.

The pipeline should still make `paid` visible as the stronger outcome.
