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

The timer runs at 06:17, 12:17, 18:17, and 23:17 server time, plus up to 15 minutes of random delay.

Each run:

1. loads brokered Cloudflare and Access credentials from `pass`
2. runs `npm run scythe:scan -- --verify`
3. writes scheduler status and logs
4. deploys the Scythe static dashboard to Cloudflare
5. verifies authenticated HTTP and browser access through Cloudflare Access
