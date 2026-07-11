/**
 * scythe-scheduled-run.test.mjs — deterministic scheduler proof.
 *
 * Run: node scythe-scheduled-run.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";

import {
  detectScanSignals,
  parseScanSummary,
  shouldPublishAfterScan
} from "./scythe-scheduled-run.mjs";

let passed = 0;
let failed = 0;
const failures = [];

function test(label, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    failures.push(label);
    console.log(`  FAIL: ${label}`);
    console.log(`    ${error.message}`);
  }
}

function decisionFor(output, dryRun = false) {
  const summary = parseScanSummary(output);
  const scanSignals = detectScanSignals(output);
  const publish = shouldPublishAfterScan({ summary, scanSignals, dryRun });
  return { summary, scanSignals, publish };
}

test("no-op scan skips deploy", () => {
  const result = decisionFor(`
Portal Scan - 2026-07-10
Companies scanned:     12
Total jobs found:      44
Duplicates:            44 skipped
New offers added:      0
`);

  assert.equal(result.summary.newOffersAdded, 0);
  assert.deepEqual(result.scanSignals, []);
  assert.equal(result.publish.required, false);
  assert.equal(result.publish.reason, "no_user_facing_change");
});

test("new offers trigger deploy", () => {
  const result = decisionFor(`
Portal Scan - 2026-07-10
Companies scanned:     12
Total jobs found:      45
Duplicates:            44 skipped
New offers added:      1
`);

  assert.equal(result.summary.newOffersAdded, 1);
  assert.equal(result.publish.required, true);
  assert.equal(result.publish.reason, "new_offers_added");
  assert.equal(result.publish.dataChanged, true);
});

test("excluded all-candidate changes trigger deploy", () => {
  const result = decisionFor(`
Portal Scan - 2026-07-10
Companies scanned:     12
Total jobs found:      45
Duplicates:            44 skipped
Excluded candidates:   1 visible
Excluded changed:      1
New offers added:      0
`);

  assert.equal(result.summary.newOffersAdded, 0);
  assert.equal(result.summary.excludedCandidatesChanged, 1);
  assert.equal(result.publish.required, true);
  assert.equal(result.publish.reason, "all_candidates_changed");
  assert.equal(result.publish.dataChanged, true);
});

test("rate-limit and block output records warnings and triggers deploy", () => {
  const result = decisionFor(`
Provider fetch failed: HTTP 429 Too Many Requests; retry-after: 120
  warning   Example | Role (HTTP 403 (access blocked, likely anti-bot))
  warning   Example | Role (anti-bot challenge: just a moment)
Portal Scan - 2026-07-10
Companies scanned:     12
Total jobs found:      44
Duplicates:            44 skipped
New offers added:      0
`);

  assert.deepEqual(
    result.scanSignals.map((signal) => signal.type).sort(),
    ["access_blocked", "bot_challenge", "rate_limit"],
  );
  assert.equal(result.scanSignals.every((signal) => signal.severity === "warning"), true);
  assert.equal(result.scanSignals.every((signal) => signal.evidence.length > 0), true);
  assert.equal(result.publish.required, true);
  assert.equal(result.publish.reason, "scan_warning_signals");
  assert.equal(result.publish.signalsNeedSurface, true);
});

test("benign Cloudflare mention is not a bot challenge", () => {
  const result = decisionFor(`
New offer: Cloudflare | Remote Engineer
Portal Scan - 2026-07-10
Companies scanned:     12
Total jobs found:      44
Duplicates:            44 skipped
New offers added:      0
`);

  assert.deepEqual(result.scanSignals, []);
  assert.equal(result.publish.required, false);
});

test("timer is exactly :00/:30 with no random delay", () => {
  const timer = fs.readFileSync("ops/systemd/scythe-scan.timer", "utf8");

  assert.match(timer, /^OnCalendar=\*-\*-\* \*:00,30:00$/m);
  assert.match(timer, /^AccuracySec=1s$/m);
  assert.match(timer, /^RandomizedDelaySec=0$/m);
  assert.doesNotMatch(timer, /06:17|12:17|18:17|23:17|15min/);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failures:", failures.join(", "));
  process.exit(1);
}
