# Mode: scythe-pipeline -- Process Opportunity Inbox

Process pending opportunity rows from `data/pipeline.md` using Scythe's opportunity model, not Career-Ops' application/CV pipeline.

## Input

Read `data/pipeline.md`. Accept common scanner rows:

```markdown
- [ ] {url} | {company} | {title} | {location} | {compensation}
- [ ] {url} | {company} | {title} | {location}
- [ ] {url} | {company} | {title}
```

Also accept manually added notes after the normal columns.

## Workflow

1. Select pending rows only: lines beginning `- [ ]`.
2. For URL rows, run liveness checking when practical. Use `node check-liveness.mjs --file <tmpfile>` for batches. If liveness cannot be checked, continue but mark the verification gap.
3. For each active or unverified row, load `SCYTHE.md`, `config/scythe.yml` if present, and `modes/opportunity.md`.
4. Evaluate the row as a Scythe opportunity. Do not generate a CV, PDF, cover letter, or Career-Ops application report unless the user explicitly asks.
5. Append one row to `data/opportunities.md` with source `posted`, the Scythe category, remote class, agent leverage, proof match, next action, status `evaluated`, and outcome `pending`.
6. Save the evaluation only when it is useful. For short evaluations, write no file and keep the tracker row. For longer or high-priority opportunities, save to `briefs/{YYYY-MM-DD}-{company-slug}-{role-slug}.md`.
7. Mark processed inbox rows as `- [x]` with a concise note: `evaluated`, `expired`, `low-priority`, or `needs-review`.

## Output

Summarize:

- processed count
- expired/closed count
- top pursue-now opportunities
- low-priority opportunities
- recommended manual next actions
- any liveness or source-quality gaps

## Guardrails

- Manual send only.
- Do not auto-apply.
- Do not write to `data/applications.md` unless the user explicitly chooses to treat an item as a Career-Ops application.
- Do not overclaim proof. Use only user-layer source-of-truth files and current-session statements.
