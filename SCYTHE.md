# Scythe Pilot

Scythe is a remote-work acquisition system forked from Career-Ops.

## Goal

Find and convert paid work that can be carried out remotely. The first pilot optimizes for getting paid as soon as possible, not for proving the most ambitious version of the thesis. Software work is a strong credibility wedge, but any domain is in scope when the work is deliverable remotely and AI agents give the operator a credible execution advantage.

## First Wedge

The first wedge is:

> cash-first remote paid work

This means any credible opportunity that can convert quickly into paid remote work: a small contract, fixed-scope task, paid trial task, hourly/day contract, implementation-included audit, short sprint, freelance engagement, remote job/contract application, or repeatable retainer lead.

## Source Mix Correction

Generic remote job-board scanning is not the primary acquisition engine for this pilot. It produces too many traditional "job jobs" and too few small remote contracts, paid trials, fixed-scope tasks, or buyer-led project openings.

Use job-board scans as a fallback and monitoring channel only. The primary sourcing lanes should be:

1. Contract marketplaces and vetted freelance networks where the work shape is explicitly contract, project, trial, hourly, day-rate, or client engagement.
2. Buyer-intent surfaces: founder/operator posts, community requests, agency overflow, productized-service gaps, "looking for help" threads, and businesses with visible execution bottlenecks.
3. Outbound target briefs for specific businesses where public evidence suggests a bounded remote execution gap.
4. Referral and network paths where the first ask can be a paid trial, small sprint, or implementation-included audit.

Traditional remote roles can still be pursued when unusually attractive, but they should not dominate the active queue.

## Real Opportunity Bar

For the contract-first pilot, a real opportunity must have a visible buyer or buyer proxy, a concrete paid need, a plausible conversation path, remote deliverability, and a bounded first paid step. A traditional job application is not enough unless it clearly leads to client-project work, a paid trial, or a fast contract conversation.

## High-Upside Lane

'Idea to first real customer' (I2C) is a high-upside Scythe lane, but it is not the default first pursuit because it usually requires more trust, diagnosis, and sales work than simpler paid opportunities.

I2C means helping an early founder, operator, or small business move from an ambiguous idea to a working v0/mvp and a real market action: payment, booking, qualified lead.

Prioritize I2C only when there is visible buyer intent, a plausible first customer action, and a path to paid scoping with first-build work or a sprint quickly.

## Opportunity Hierarchy

1. Fast paid remote work: concrete paid tasks, contracts, paid trials, hourly/day work, implementation-included audits, sprints, applications, or retainers with a short path to payment.
2. Software-adjacent contract work: automation, internal tools, AI workflows, technical prototypes.
3. Agent-leveraged knowledge work in any domain: research, synthesis, documentation, process mapping, structured production, coordination.
4. I2C: high-upside project-bootstrap work, pursued selectively when it can become paid quickly.
5. Generic remote work: acceptable when economics, speed, learning, network access, or proof value justify pursuing it.

This hierarchy ranks opportunities. It is not a hard category wall.

## Operating Loop

1. Discover contract-first opportunities, buyer-intent signals, and outbound targets. Treat traditional posted jobs as fallback inventory.
2. Classify remote execution, agent leverage, buyer type, pain signal, economics, proof match, and urgency.
3. Produce the right artifact: application, one-page opportunity brief, paid trial proposal, implementation-included audit angle, or v0 sprint angle.
4. The operator manually reviews and sends. Scythe drafts and queues only.
5. Track conversation state and follow up.
6. Convert to paid trial, fixed deliverable, hourly/day contract, sprint, retainer, or archive.
7. Feed outcomes back into scoring.

## Local Helper

Use `node scythe.mjs init` to seed ignored local pilot files, `node scythe.mjs scan --dry-run` to preview board results, `node scythe.mjs scan` to write new scan results into `data/pipeline.md`, and `node scythe.mjs status` to summarize local opportunity/saved/target/conversation trackers.

Use `data/saved.md` for attractive roles, buyers, JDs, and work shapes that are not part of the immediate cash-first queue because they are aspirational, slower, too strategic, or need proof-building first.

Use `npm run scythe:web` for the minimal Scythe dashboard in `scythe-web/`. The legacy Career-Ops frontend remains in `web/`; Scythe should not depend on that app shell unless a specific need arises.

## Non-Negotiables

- Remote execution is mandatory. Timezone overlap is negotiable. Travel is exceptional.
- Do not auto-send outreach, auto-apply, or mass-message.
- Do not overclaim domain expertise. For unfamiliar domains, the work must be decomposable into research, synthesis, structured production, communication, automation, or coordination, with a clear validation path.
- Do not turn unpaid pre-contact analysis into free consulting. Pre-contact research should produce a one-page brief, not a full plan.
- Personal profile data, opportunity lists, generated briefs, and outreach drafts stay in the user layer and out of Git.

## Pilot Success Metric

The first two-week pilot should prove that Scythe can create qualified paid-work conversations:

- suitable opportunities or targets found
- tailored applications or opportunity briefs generated
- outreach good enough for manual send
- replies or calls from people with plausible paid need, authority or influence, remote compatibility, and a concrete next step

Signed work is the real objective, but qualified conversations are the first feedback loop.
