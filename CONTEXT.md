# Scythe Context

## Purpose

Scythe is a private remote-work acquisition system for finding and converting paid work that can be carried out remotely. The pilot optimizes for getting paid as soon as possible while preserving the broader thesis that agent-native work can be delivered across many domains.

Scythe has two primary interfaces:

- Codex is the action interface. The operator uses Codex to inspect items, reason about fit, decide positioning, draft applications or outreach, prepare for calls, update trackers, and move work forward.
- The GUI is the observability interface. It should expose what Scythe knows, what is stale or unknown, and where each item sits, without trying to become the primary place where action is taken.

## Glossary

### Operator

The person using Scythe with Codex to decide and execute paid-work actions. In this pilot, the operator is Lewis.

### Opportunity

A possible path to paid remote work. This can be a job, contract, paid trial, fixed-scope task, short sprint, retainer lead, outbound target, or agent-leveraged knowledge-work opening.

### Opportunity State

The lifecycle position of an opportunity. The initial states are:

- `inbox` - collected but not evaluated.
- `inspect` - needs source, JD, buyer, or listing review.
- `qualified` - plausible, but no committed action yet.
- `active` - worth acting on now.
- `waiting` - an action has been sent or taken and Scythe is awaiting response, result, or time-based follow-up.
- `saved` - attractive but not for now.
- `archived` - not worth active attention.
- `converted` - produced a qualified paid-work conversation or paid work.

### Outcome

The result level reached by an opportunity. Initial outcome levels include:

- `pending` - no result yet.
- `conversation` - a real person with authority or influence is engaged around plausible paid work and there is a concrete next step.
- `paid` - money is agreed, invoiced, paid, or contractually committed.
- `deferred` - intentionally saved or postponed.
- `rejected` - declined, no response after reasonable follow-up, or not selected.
- `superseded` - duplicate or replaced by another item.

### Action

The next concrete thing the operator can do to move an opportunity toward paid work or remove it from active attention. Examples include inspect JD, prepare positioning, apply, draft outreach, follow up, save, defer, or archive.

### Action Type

The kind of next move Scythe is asking the operator to take. The initial action types are `inspect`, `position`, `apply`, `draft-outreach`, `send-follow-up`, `prepare-call`, `save`, and `archive`.

### Action State

The execution state of an action. The initial action states are `ready`, `blocked`, `drafted`, `sent`, `done`, and `skipped`.

### Active Item

An opportunity that is still live enough to require attention, judgement, inspection, application prep, outreach, or follow-up.

### Saved Item

An attractive opportunity, role shape, buyer, or job description that is not part of the immediate cash-first queue because it is slower, aspirational, underqualified for now, strategically useful later, or needs proof-building first.

### Queue

The Codex-facing action surface. The queue should show actions as the primary unit, with the opportunity as context. It should contain the smallest set of active actions needed for the operator and Codex to choose and execute the next best action.

Opportunity state and action state are separate. Opportunities persist through the lifecycle; actions move them forward.

An opportunity may have many actions in the underlying model, but Codex should usually present one primary action per opportunity when driving a working session. Full action history and secondary actions belong in observability views or item detail.

### GUI

The browser interface for observing Scythe state. The GUI should be terse, compact, and state-first. It should show collected opportunities, saved items, classifications, statuses, outcomes, freshness, and raw/detail views where useful. It should not try to replace Codex as the primary action-taking interface.

The GUI should answer "what does Scythe currently know?" while Codex answers "what should we do next?" It should optimize for inventory, state, freshness, exceptions, and drill-down. It should not optimize for action buttons, drafting surfaces, complex workflow controls, or prose-heavy explanations on main screens.

The GUI should be optimized for a base Pixel 10 mobile portrait viewport as a first-class target. The working layout target is `360 x 732` CSS pixels at DPR 3, matching the Pixel 10 device descriptor and Google's 1080 x 2424, 20:9 display specification. Main observability surfaces should remain legible without horizontal scrolling at that width.

The minimum GUI page set is:

- `Overview` - terse system snapshot and exceptions.
- `Opportunities` - full collected opportunity inventory.
- `Saved` - deferred or future-use signals.
- `State` - counts, freshness, source/status/outcome distribution.
- `Item detail` - later, for one record's raw source, notes, history, and generated artifacts.

Do not add analytics, pipeline-board, calendar, CRM, or similar dashboard surfaces until real usage proves they are needed.

## Default Process

The initial lifecycle sequence is:

1. `inbox` + `inspect` - confirm the source is live, remote-compatible, and not obviously irrelevant.
2. `inspect` + `position` - decide whether there is a credible angle and what the main risk or claim is.
3. `qualified` + `apply` or `draft-outreach` - produce the artifact that can start a paid-work conversation.
4. `active` + `prepare-call` - prepare only when screening, interview, or client-call risk justifies it.
5. `waiting` + `send-follow-up` - after applying, contacting, or sending, track the next due follow-up.
6. `saved`, `archived`, or `converted` - exit active attention.

Scythe should not normally push an item directly to `apply` or `draft-outreach` until it has passed `inspect` and `position`, unless the opportunity is trivially obvious.

### Observability

The ability to inspect the complete state of information Scythe has collected or inferred: opportunities, saved items, classifications, scan outputs, statuses, notes, outcomes, and data freshness. Observability does not mean everything belongs on the landing view.

Observability should be terse by default. The operator should be able to see state, source, classification, and freshness without reading prose-heavy explanations. Longer notes, generated briefs, raw source data, and parser/debug detail should be available only when the operator drills into an item or inspection view.

## Product Boundary

Scythe is not a job board, CRM, application tracker, or generic career dashboard. For the pilot, it is a private remote-work acquisition system operated primarily through Codex.

The GUI should provide observability into collected information and system state. It should not be designed as the primary action-taking surface.

## Source Strategy

The current critical system risk is source quality. Generic remote job-board scanning is overproducing traditional roles and underproducing remote contractual work. That is a sourcing failure, not a GUI problem.

Scythe should treat traditional remote job boards as fallback inventory. Primary discovery should focus on contract marketplaces, vetted freelance networks, buyer-intent posts, agency/operator overflow, public "looking for help" signals, outbound target briefs, and referral paths where the natural next step can be a paid trial, fixed deliverable, short sprint, hourly/day contract, implementation-included audit, or retainer.

The active queue should not be allowed to fill mainly with traditional job applications unless the operator explicitly chooses a job-search session.

### Real Opportunity

A real Scythe opportunity has:

- a visible buyer or buyer proxy;
- a concrete paid need;
- a plausible path to a conversation with that buyer or proxy;
- remote deliverability;
- a bounded first paid step, such as a fixed deliverable, paid trial, hourly engagement, short sprint, implementation-included audit, or retainer-shaped pilot;
- enough source evidence to verify the opportunity exists now.

Traditional job applications can be useful, but they do not satisfy the contract-first sourcing goal unless the source evidence shows a short path to paid work or a client-project conversation.
