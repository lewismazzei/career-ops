# Dispatch Autopilot

Dispatch autopilot is an experimental Scythe control plane that reduces the manual loop:

```text
implementation request -> dispatch worker -> ready -> integrate -> verify -> deploy -> push
```

The worker is not the release authority. Workers can propose patches and run cheap local checks. The VPS integration pass runs the authoritative checks with the known-good environment: secrets broker, Cloudflare credentials, D1 access, Playwright system libraries, deploy configuration, and GitHub SSH auth.

## Commands

Plan without modifying anything:

```sh
npm run scythe:dispatch:plan
```

Adopt a worker so autopilot is allowed to process it:

```sh
node dispatch-autopilot.mjs adopt --worker WORKER
```

Run one integration pass without deploy or push:

```sh
npm run scythe:dispatch:apply
```

Run one full integration/deploy/push pass:

```sh
npm run scythe:dispatch:ship
```

Spawn a Codex-backed worker through the local authenticated Codex CLI:

```sh
node dispatch-autopilot.mjs spawn --background --task "TASK" --owner "FILES OR DIRS" --avoid "FILES OR DIRS"
```

## Safety Model

Autopilot ignores a dispatch worker unless all are true:

- worker status is `ready`
- worker repo matches `/home/lewis/projects/scythe`
- worker has been adopted with `node dispatch-autopilot.mjs adopt --worker WORKER`
- source checkout is clean and on `pilot`
- worker result is not the pending template
- changed paths satisfy `config/dispatch-autopilot.scythe.json`
- integration merge is conflict-free
- integration checks pass

Deploy and push require both config enablement and command flags. The packaged full pass uses:

```sh
node dispatch-autopilot.mjs once --apply --deploy --push
```

## Checks

The Scythe config currently runs:

- `npm run scythe:web:typecheck`
- `npm run scythe:web:build`
- `eval "$(npm run --silent scythe:env)" && npm run scythe:web:deploy`
- `eval "$(npm run --silent scythe:env)" && npm run scythe:verify:auth`
- `eval "$(npm run --silent scythe:env)" && npm run scythe:verify:browser`

Worker checks are advisory. These integration checks are the release gate.

## State

Generated state and logs live under:

```text
logs/dispatch-autopilot/
```

This directory is gitignored through the existing `logs/*` rule.

Each run writes:

- `status.json`
- `events.ndjson`
- one log per worker integration attempt
- one Codex log per background Codex worker spawn

## systemd

Templates:

- `ops/systemd/scythe-dispatch-autopilot.service`
- `ops/systemd/scythe-dispatch-autopilot.timer`

Install:

```sh
sudo cp /home/lewis/projects/scythe/ops/systemd/scythe-dispatch-autopilot.service /etc/systemd/system/scythe-dispatch-autopilot.service && sudo cp /home/lewis/projects/scythe/ops/systemd/scythe-dispatch-autopilot.timer /etc/systemd/system/scythe-dispatch-autopilot.timer && sudo systemctl daemon-reload && sudo systemctl enable --now scythe-dispatch-autopilot.timer
```

Check:

```sh
systemctl list-timers scythe-dispatch-autopilot.timer && systemctl status scythe-dispatch-autopilot.timer --no-pager && systemctl status scythe-dispatch-autopilot.service --no-pager
```

Logs:

```sh
journalctl -u scythe-dispatch-autopilot.service -n 100 --no-pager
```

## Current Boundaries

This is a conservative MVP:

- It does not bypass review for unadopted workers.
- It does not install or enable systemd automatically.
- It does not clean worker worktrees.
- It blocks on dirty source checkout, merge conflicts, path policy failures, pending worker results, failed checks, failed deploy, or failed production verification.
- It uses the local authenticated `codex exec` CLI for background workers, not the OpenAI API.
