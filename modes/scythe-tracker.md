# Mode: scythe-tracker -- Opportunity State Review

Summarize Scythe's local paid-work pipeline.

## Sources

Read:

- `data/opportunities.md`
- `data/saved.md`
- `data/targets.md`
- `data/conversations.md`
- `data/pipeline.md` if present
- `config/scythe.yml` if present

## Output

Return:

1. Counts by status and outcome.
2. Best next actions for the next working session.
3. Opportunities that appear closest to payment.
4. Saved opportunities worth revisiting later, with the trigger or gap that would make them live again.
5. Targets that need a one-page opportunity brief.
6. Follow-ups due or missing.
7. Any tracker hygiene issues: missing category, remote class, next action, outcome, follow-up date, saved reason, or revisit trigger.

## Priority Rule

Rank by time to cash first, then remote executability, agent leverage, proof match, and strategic value.

## Guardrails

- Do not infer outreach was sent unless `data/conversations.md` or the user says so.
- Do not fabricate outcomes.
- Do not treat likes, views, or vague networking as qualified conversations.
