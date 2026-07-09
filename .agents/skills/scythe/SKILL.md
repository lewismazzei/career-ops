---
name: scythe
description: Remote paid-work acquisition command center -- evaluate opportunities, create outbound opportunity briefs, and track qualified conversations.
arguments: mode
user_invocable: true
user-invocable: true
argument-hint: "[opportunity | target-brief | v0-launch | scan | pipeline | tracker]"
license: MIT
---

# Scythe -- Router

Scythe is a private-first remote paid-work acquisition system. It is forked from Career-Ops and reuses Career-Ops infrastructure where useful, but its goal is broader than job search: find paid work the operator can execute remotely with agent leverage.

## Invocation

If slash commands are available:

```text
/scythe opportunity {posting, JD, gig, project brief, or URL}
/scythe target-brief {person, business, URL, or observed pain signal}
/scythe v0-launch {idea, founder need, project brief, or target}
/scythe scan
/scythe pipeline
/scythe tracker
```

In Codex, use plain language:

```text
Run Scythe opportunity mode for this listing: {text or URL}
Run Scythe target-brief mode for this company/person: {context}
Run Scythe v0-launch mode for this idea: {context}
```

## Mode Routing

Determine the mode from `$mode`:

| Input | Mode |
| --- | --- |
| empty | `scythe` discovery menu |
| `opportunity` | `modes/opportunity.md` |
| `target-brief` or `brief` | `modes/target-brief.md` |
| `v0-launch`, `bootstrap`, or `first-customer` | `modes/v0-launch.md` |
| `scan` | Career-Ops `modes/scan.md`, with Scythe filters from `portals.yml` |
| `pipeline` | `modes/scythe-pipeline.md` |
| `tracker` | `modes/scythe-tracker.md` |
| unknown text that looks like a posting/gig/project | `modes/opportunity.md` |
| unknown text that looks like a person/business/target | `modes/target-brief.md` |

## Context Loading

For every Scythe mode, read:

- `SCYTHE.md`
- the routed `modes/*.md` file
- `config/scythe.yml` if present
- `config/profile.yml` if present
- `modes/_profile.md` if present
- `article-digest.md` if present
- `cv.md` if present
- `voice-dna.md` if present, for writing style only

Never fabricate claims from memory or adjacent local repos. User-facing claims must be backed by in-scope user-layer files or explicit current-session user statements.

## Manual-Send Rule

Scythe drafts, scores, queues, and tracks. It must never auto-send outreach, auto-apply, or submit forms without the operator's explicit review and action.
