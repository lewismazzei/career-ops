# Mode: source-review-loop -- Five Strong Opportunities With Fresh Review

Use this loop when the operator wants a batch of strong paid remote work opportunities, not a broad scan.

## Goal Contract

Set or state one concrete objective:

Find five strong opportunities for Lewis to have a plausible conversation about paid remote work.

The stop condition is not "five rows exist". The stop condition is:

1. five active opportunities are recorded;
2. each passes the current strength rubric;
3. weak or attractive-but-not-now items are saved or disregarded instead of counted;
4. deterministic checks pass where practical;
5. a fresh read-only reviewer returns PASS and names the counted rows.

## Current Strength Rubric

Start from `modes/contract-source.md`. Then apply these additional checks:

- Lewis can credibly start the conversation without overclaiming exact domain or platform expertise.
- The opportunity has a buyer-supported bounded paid step, not merely an imagined scope boundary.
- Visible competition is not obviously too hot unless Lewis has a specific wedge.
- The next paid conversation is plausibly closer than a traditional job application/interview path.
- The source is accessible to the operator and recent enough to act on.
- The opportunity fits paid remote work, not just an attractive future identity.

When the operator asks for opportunities that are "easy to acquire", tighten the bar again:

- Prefer low or hidden competition over public threads with many strong specialist replies.
- Prefer generic software, AI-assisted execution, research, writing, ops, QA, cleanup, setup, or small automation tasks over deep platform/domain-specialist work.
- Prefer work where a credible first message can be short and specific without a portfolio-heavy proof burden.
- Prefer small paid trials, one-off fixed deliverables, and quick hourly help over complex builds.
- Do not count attractive opportunities that mainly teach what to build expertise for later.

## State Transitions

Use these transitions after the operator or reviewer judges a candidate:

- `pursue | pending`: active candidate for the current five.
- `saved | future-target`: attractive but not immediate; record gap and revisit trigger in `data/saved.md`.
- `maybe | pending`: real but not currently counted; needs inspection or a stronger wedge.
- `low-priority | disregarded`: broken, inaccessible, too weak, too mismatched, or not worth revisiting unless source conditions change.
- `duplicate | superseded`: same opportunity shape already represented elsewhere.

## Loop Steps

1. Read current state: `data/opportunities.md`, `data/saved.md`, recent evidence briefs, and latest user feedback.
2. Declare the goal and stop condition in plain language.
3. Source across multiple lanes before accepting the batch: communities, marketplaces, referral signals, bounty boards, agency overflow, outbound target briefs, and broad job boards only as fallback.
4. For each candidate, record buyer, need, paid step, conversation path, remote fit, proof match, competition signal, source freshness, risks, next action, and URL.
5. Reject or demote candidates that only look strong because the category is attractive.
6. Save attractive-but-not-now candidates with a gap to close and revisit trigger.
7. Disregard broken or inaccessible candidates.
8. Run simple checks: counted row count, status/outcome consistency, source mix, non-saved/non-disregarded count, and URL accessibility where practical.
9. Spawn a fresh read-only reviewer. The reviewer must not be the sourcing agent.
10. Ask the reviewer for PASS/FAIL, counted rows, rejected rows, weakest counted row, and required changes.
11. If the reviewer fails the batch, iterate sourcing or demote weak rows.
12. If the reviewer passes, surface the five and wait for operator judgement.
13. Apply operator judgement to tracker state and update the rubric if a new rejection reason appears.

## Reviewer Prompt Shape

Use a prompt like:

```text
You are a fresh reviewer for a Scythe sourcing batch. Do not edit files.

Audit against modes/source-review-loop.md and modes/contract-source.md.

The goal is to find five strong opportunities for Lewis to have a plausible conversation about paid remote work.

A candidate counts only if it is active, not saved, not disregarded, has a visible buyer/proxy, concrete paid need, plausible conversation path, remote deliverability, bounded first paid step, current evidence, credible Lewis fit, and acceptable competition pressure.

Return:
1. PASS or FAIL.
2. Counted rows and reasons.
3. Rejected/demoted rows and reasons.
4. Weakest counted row.
5. Required changes before completion.
```

## Improvement Rule

Treat user pushback as error analysis. If Lewis saves or disregards reviewer-passed items, add the reason to the next run's rubric instead of arguing from the old rubric.
