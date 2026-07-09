# ADR 0007: Contract-first sourcing is the primary acquisition engine

## Status

Accepted

## Context

The initial Scythe scan pulled mostly from broad remote job boards. Even with contract-oriented title filters, the resulting opportunity mix was dominated by traditional roles and contractor-labelled job applications. This does not match the pilot's real priority: paid remote work that can plausibly convert quickly.

The user identified this as the main point of contention: the ratio between traditional "job jobs" and remote contractual work is unacceptable.

## Decision

Scythe will treat broad remote job-board scanning as fallback inventory, not the primary acquisition engine.

Primary sourcing should focus on:

- contract marketplaces and vetted freelance networks;
- buyer-intent posts and "looking for help" signals;
- agency, founder, operator, and community overflow;
- outbound target briefs where public evidence suggests a bounded execution gap;
- referral paths where the first ask can be a paid trial, fixed deliverable, short sprint, hourly/day contract, implementation-included audit, or retainer.

Traditional remote roles may still be pursued when unusually attractive, but they should not dominate the active queue unless the operator explicitly chooses a job-search session.

## Consequences

The current `scythe scan` path is useful for monitoring, but insufficient as the main engine.

Future sourcing work should build or manually operate contract-first discovery lanes before optimizing job-board ranking.

The active queue should be audited for source mix. If most active items are traditional job applications, Scythe is failing the pilot objective even if the roles are remote and technically plausible.
