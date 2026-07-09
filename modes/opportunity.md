# Mode: opportunity -- Remote Paid-Work Evaluation

Evaluate any potential paid-work opportunity: job, contract, freelance listing, project brief, startup need, referral, community post, or client request.

The objective is not "would this be a good job?" The objective is:

> Can the operator win and deliver this paid work remotely, with agent leverage, and can it plausibly produce payment soon?

## Inputs

Accept:

- URL
- pasted listing/JD/gig text
- project brief
- referral note
- recruiter/client message
- free-form opportunity description

If a URL is provided and browser/web tools are available, verify that the page is live before scoring. If liveness cannot be checked, state the limitation and continue from the provided text.

## Sources Of Truth

Use only:

- `cv.md`
- `article-digest.md`
- `config/profile.yml`
- `config/scythe.yml`
- `modes/_profile.md`
- current-session user statements
- the provided opportunity text or page

Do not claim experience, metrics, authorship, client details, or domain expertise unless supported by those sources.

## Classification

Classify the opportunity:

| Field | Allowed values |
| --- | --- |
| Category | `fast-paid-remote`, `software-contract`, `agent-leveraged-knowledge-work`, `v0-launch`, `generic-remote`, `other` |
| Source | `posted`, `outbound`, `referral`, `community`, `recruiter`, `direct`, `unknown` |
| Buyer type | `founder`, `small-business`, `startup`, `agency`, `recruiter`, `platform`, `operator`, `unknown` |
| Remote class | `async-global`, `timezone-overlap`, `country-bound`, `travel-exceptional`, `onsite-or-hybrid`, `unknown` |
| Work shape | `fixed-scope`, `paid-trial`, `implementation-audit`, `sprint`, `retainer`, `hourly`, `day-rate`, `employment`, `equity-only`, `unknown` |

## Scoring

Score 1-5:

| Dimension | Weight | Criteria |
| --- | ---: | --- |
| Remote execution | 20% | 5=location-transparent, 1=regular onsite/hybrid |
| Time to cash | 20% | 5=clear short path to paid work, 1=slow or speculative |
| Agent leverage | 15% | 5=agents materially improve speed/quality, 1=no credible leverage |
| Proof match | 15% | 5=strong backed proof, 1=no relevant proof |
| Path to paid conversation | 15% | 5=clear buyer + pain + next step, 1=no route to buyer |
| Delivery boundedness | 10% | 5=can affect outcome in 2-4 weeks, 1=unbounded or blocked |
| Economics quality | 5% | 5=paid sprint/retainer/repeatable, 1=low-value or unpaid |

Do not hard-reject low economics on the first pass. Flag them and rank them. Only flag obvious scams, illegal work, or impossible delivery as "do not pursue".

## Required Output

```markdown
# Scythe Opportunity Evaluation

**Verdict:** pursue | maybe | low-priority | do-not-pursue
**Category:**
**Remote class:**
**Buyer type:**
**Work shape:**
**Score:** X.X/5
**Next action:** apply | target brief | paid trial | fixed deliverable | implementation audit | ask clarifying question | archive

## Time To Cash
- ...

## Why This Might Convert
- ...

## Remote Execution
- ...

## Agent Leverage
- ...

## Proof Match
- Use only backed proof points.

## Risks / Unknowns
- ...

## Suggested Angle
- ...

## Draft Next Step
Provide a short application, reply, or outreach draft if enough context exists.
If not, ask for the minimum missing information.
```

## Routing

- If the strongest path is a posted application, produce an application/reply draft.
- If the strongest path is outbound, recommend `target-brief`.
- If the strongest path is idea-to-first-customer and there is a fast path to paid scoping with first-build work or a sprint, recommend `v0-launch`.
- If the opportunity is low quality, explain why and what signal would change the score.
