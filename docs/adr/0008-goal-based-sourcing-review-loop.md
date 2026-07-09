# ADR 0008: Goal-based sourcing review loop

## Status

Accepted

## Context

The useful unit of work in the pilot is not "scan job boards" or "find roles". The useful unit is a repeatable loop:

1. Set a concrete goal: find five strong opportunities.
2. Source live opportunities.
3. Apply Scythe's current definition of "strong".
4. Record evidence and state.
5. Ask a fresh reviewer to reject weak candidates.
6. Iterate until the stop condition is true.
7. Let user feedback update the definition of strong.

The 2026 "loop engineering" discourse maps cleanly onto this. Addy Osmani defines loop engineering as replacing yourself as the person manually prompting an agent with a small system that prompts, checks, remembers, and continues. He describes a loop as a recursive goal with a purpose and an AI that iterates until complete, with automations, skills, connectors, state, and subagents as the supporting pieces.

OpenAI's Codex goal guidance frames the same pattern operationally: name one objective, name one stopping condition, point Codex at required context, define proof artifacts, work in checkpoints, and inspect goal status while it runs.

Anthropic's agent-pattern guidance is also a fit. Their evaluator-optimizer workflow uses one model call to produce work and another to evaluate and feed back in a loop, and they recommend explicit ground truth, stopping conditions, simplicity, transparency, and human checkpoints for agent loops.

Hamel Husain and Shreya Shankar's eval guidance adds an important correction: start with error analysis, not infrastructure. In Scythe terms, each time the user says "these looked good but were actually too hot / too expert / too slow / broken", that is not an annoyance. It is training data for the loop's eval rubric.

## Decision

Scythe will treat "find five strong opportunities with fresh-reviewer acceptance" as a named reusable loop, not as an ad hoc prompt.

The loop is the `source-review-loop`.

It has:

- Trigger: user asks for a batch of remote paid work opportunities, or a scheduled sourcing automation fires.
- Objective: find five strong opportunities for Lewis to have a plausible conversation about paid remote work.
- State: `data/opportunities.md`, `data/saved.md`, dated evidence briefs, source URLs, user review notes, and reviewer verdicts.
- Method: `modes/contract-source.md` plus the stricter source-review loop mode.
- Reviewer: a fresh read-only subagent that did not source the batch.
- Stop condition: a fresh reviewer agrees there are at least five active, non-saved, non-disregarded opportunities that satisfy the current strength rubric.
- Human checkpoint: Lewis can promote, save for later, or disregard each accepted item; that feedback updates the rubric.

## Strength Rubric

A strong opportunity must pass the real opportunity test from `modes/contract-source.md` and also survive these sharper checks:

- fit: Lewis can credibly start the conversation without pretending to have domain/platform expertise he does not have;
- competition: visible replies, bids, and profiles do not make the item obviously overheated unless Lewis has a wedge;
- time-to-cash: the next step could plausibly reach paid scope faster than a traditional hiring pipeline;
- first paid step: there is a buyer-supported paid trial, fixed deliverable, short sprint, hourly contract, or other bounded commercial step;
- evidence: the source is live, accessible to the operator, and recent enough to act on;
- source quality: job-board-style application funnels and generic contractor roles are fallback inventory, not primary countable items.

When an item is attractive but fails one of these sharper checks, save it instead of forcing it into the active five. When it is broken, inaccessible, scammy, overbroad, or too weak, disregard it.

## Loop Shape

1. Load current state and the user's latest feedback.
2. Form a concrete goal with a stop condition: five strong active opportunities.
3. Source from multiple lanes: communities, marketplaces, referral signals, bounty boards, agency overflow, outbound target briefs, and only then job boards.
4. For each candidate, capture buyer, need, paid step, conversation path, remote fit, proof match, competition signal, risks, and URL.
5. Promote only candidates that pass the strength rubric.
6. Mark attractive-but-not-now candidates as saved with a gap and revisit trigger.
7. Mark weak, inaccessible, or broken candidates as low-priority or disregarded.
8. Run deterministic checks where possible: row counts, source mix, status/outcome consistency, URL family checks.
9. Spawn a fresh reviewer with no sourcing context and require PASS/FAIL plus counted rows.
10. If FAIL, iterate sourcing or demote weak rows.
11. If PASS, surface the five to Lewis and await human judgement.
12. Convert Lewis's judgement into tracker state and rubric updates.

## Consequences

This loop makes Scythe more like an operating system component than a one-off search session.

The GUI remains observability: it should show active, saved, disregarded, source mix, freshness, and review verdicts.

Codex remains the action interface: it runs the loop, records evidence, calls reviewers, and updates state.

The loop should be improved by measuring:

- how many reviewer-passed opportunities Lewis later saves or disregards;
- recurring rejection reasons;
- time from sourced item to first outbound message;
- time from outbound message to paid conversation;
- source families that produce real conversations;
- proof gaps that repeatedly block otherwise good opportunities.

The first correction from this run is concrete: "real and paid" is not enough. Strong also means Lewis has a credible wedge despite expertise gaps and visible competition.

## Research Notes

- Addy Osmani, "Loop Engineering", 2026-06-07: https://addyosmani.com/blog/loop-engineering/
- OpenAI Developers, "Follow a goal": https://developers.openai.com/codex/use-cases/follow-goals
- OpenAI Developers, "Subagents": https://developers.openai.com/codex/subagents
- OpenAI Developers, "Agent Skills": https://developers.openai.com/codex/skills
- Anthropic, "Building effective agents", 2024-12-19: https://www.anthropic.com/engineering/building-effective-agents
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- Hamel Husain and Shreya Shankar, "LLM Evals: Everything You Need to Know", 2026-01-15: https://hamel.dev/blog/posts/evals-faq/
- Lenny's Newsletter / How I AI, "How to design AI agent loops": https://www.lennysnewsletter.com/p/how-to-design-ai-agent-loops-schedules
- O'Reilly Radar, "Loop Engineering": https://www.oreilly.com/radar/loop-engineering/
