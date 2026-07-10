# Scheduled Scans

Scythe scheduled scans run on the VPS through systemd.

## Files

- `scythe-scheduled-run.mjs`: project-local runner
- `ops/systemd/scythe-scan.service`: systemd service
- `ops/systemd/scythe-scan.timer`: systemd timer
- `data/scythe-scheduler-status.json`: latest run status, generated and gitignored
- `logs/scythe-scheduler/`: run logs, generated and gitignored

## Install

```sh
sudo cp /home/lewis/projects/scythe/ops/systemd/scythe-scan.service /etc/systemd/system/scythe-scan.service && sudo cp /home/lewis/projects/scythe/ops/systemd/scythe-scan.timer /etc/systemd/system/scythe-scan.timer && sudo systemctl daemon-reload && sudo systemctl enable --now scythe-scan.timer
```

## Check

```sh
systemctl list-timers scythe-scan.timer && systemctl status scythe-scan.timer --no-pager && systemctl status scythe-scan.service --no-pager
```

Recent logs:

```sh
journalctl -u scythe-scan.service -n 100 --no-pager
```

Project-level dry run:

```sh
npm run scythe:scheduled:dry
```

Manual full run:

```sh
npm run scythe:scheduled
```

## Schedule

The timer runs every 30 minutes exactly on the hour and half past (`:00` and `:30`) server time, with no randomized delay.

Each run:

1. loads brokered Cloudflare and Access credentials from `pass`
2. runs `npm run scythe:scan -- --verify`
3. writes scheduler status and logs locally
4. deploys the Scythe static dashboard to Cloudflare only when the scan adds new offers or detects rate-limit/access-blocking/bot-challenge signals that need to be surfaced
5. verifies authenticated HTTP and browser access through Cloudflare Access only after a deployment

`data/scythe-scheduler-status.json` includes the scan summary, the publish decision, and any structured scan signals. No-op scans still refresh the local status file but skip deploy and verification.
