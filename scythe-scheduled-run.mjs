#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const LOG_DIR = "logs/scythe-scheduler";
const STATUS_PATH = "data/scythe-scheduler-status.json";
const LOCK_PATH = "data/scythe-scheduler.lock";
const STALE_LOCK_MS = 3 * 60 * 60 * 1000;
const MAX_WARNING_EVIDENCE = 5;

const SECRET_REFS = {
  CLOUDFLARE_API_TOKEN: "cloudflare/scythe/access-admin-token",
  CF_ACCESS_CLIENT_ID: "cloudflare/scythe/access-service-client-id",
  CF_ACCESS_CLIENT_SECRET: "cloudflare/scythe/access-service-client-secret"
};

function usage() {
  console.log(`Usage:
  node scythe-scheduled-run.mjs [--dry-run] [--skip-deploy] [--skip-browser] [--no-scan-verify]

Default run:
  scan with liveness verification
  write scheduler status
  deploy the static Scythe UI to Cloudflare
  verify protected HTTP and browser access`);
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  return {
    help: flags.has("--help") || flags.has("-h"),
    dryRun: flags.has("--dry-run"),
    skipDeploy: flags.has("--skip-deploy"),
    skipBrowser: flags.has("--skip-browser"),
    scanVerify: !flags.has("--no-scan-verify")
  };
}

function nowIso() {
  return new Date().toISOString();
}

function compactTimestamp(iso) {
  return iso.replaceAll(":", "").replaceAll("-", "").replace(/\.\d{3}Z$/, "Z");
}

function ensureDirs() {
  fs.mkdirSync("data", { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function readPass(name) {
  return execFileSync("pass", ["show", name], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function brokeredEnv() {
  const env = { ...process.env };
  for (const [envName, passName] of Object.entries(SECRET_REFS)) {
    const value = readPass(passName);
    if (!value) throw new Error(`pass entry is empty: ${passName}`);
    env[envName] = value;
  }
  return env;
}

function removeStaleLock() {
  if (!fs.existsSync(LOCK_PATH)) return;
  const stat = fs.statSync(LOCK_PATH);
  if (Date.now() - stat.mtimeMs < STALE_LOCK_MS) return;
  fs.rmSync(LOCK_PATH, { force: true });
}

function acquireLock() {
  removeStaleLock();
  let fd;
  try {
    fd = fs.openSync(LOCK_PATH, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      const current = fs.readFileSync(LOCK_PATH, "utf8").trim();
      throw new Error(`scheduler already running (${current || LOCK_PATH})`);
    }
    throw error;
  }
  fs.writeFileSync(fd, `pid=${process.pid}\nstarted_at=${nowIso()}\n`, "utf8");
  fs.closeSync(fd);
}

function releaseLock() {
  fs.rmSync(LOCK_PATH, { force: true });
}

function readPendingPipelineCount() {
  let text;
  try {
    text = fs.readFileSync("data/pipeline.md", "utf8");
  } catch {
    return 0;
  }
  const pendingStart = text.indexOf("## Pending");
  if (pendingStart === -1) return 0;
  const nextSection = text.indexOf("\n## ", pendingStart + "## Pending".length);
  const pending = nextSection === -1 ? text.slice(pendingStart) : text.slice(pendingStart, nextSection);
  return pending.split(/\r?\n/).filter((line) => /^- \[ \] https?:\/\//.test(line.trim())).length;
}

function parseScanSummary(output) {
  const intAfter = (label) => {
    const match = output.match(new RegExp(`${label}:\\s+(\\d+)`));
    return match ? Number(match[1]) : null;
  };

  return {
    companiesScanned: intAfter("Companies scanned"),
    jobBoardsScanned: intAfter("Job boards scanned"),
    totalJobsFound: intAfter("Total jobs found"),
    duplicatesSkipped: intAfter("Duplicates"),
    newOffersAdded: intAfter("New offers added"),
    expiredDropped: intAfter("Expired \\(verified\\)"),
    noApplyDropped: intAfter("No apply control"),
    invalidDropped: intAfter("Invalid \\(guarded\\)")
  };
}

const SCAN_SIGNAL_DETECTORS = [
  {
    type: "rate_limit",
    severity: "warning",
    patterns: [
      /\bhttp\s*429\b/i,
      /\b429\b.*\btoo many requests\b/i,
      /\btoo many requests\b/i,
      /\brate[-\s]?limit(?:ed|ing)?\b/i,
      /\bretry-after\b/i,
      /\bquota exceeded\b/i
    ]
  },
  {
    type: "access_blocked",
    severity: "warning",
    patterns: [
      /\baccess_blocked\b/i,
      /\baccess blocked\b/i,
      /\bhttp\s*403\b/i,
      /\bhttp\s*503\b/i,
      /\b403\b.*\bforbidden\b/i,
      /\bforbidden\b/i,
      /\bblocked_host\b/i,
      /\bskipped_blocked_host\b/i
    ]
  },
  {
    type: "bot_challenge",
    severity: "warning",
    patterns: [
      /\bbot_challenge\b/i,
      /\banti[-\s]?bot challenge\b/i,
      /\bjust a moment\b/i,
      /\bcloudflare\b.*\b(challenge|captcha|verification|checking)\b/i,
      /\bcaptcha\b/i,
      /\bhcaptcha\b/i,
      /\brecaptcha\b/i,
      /\bsecurity verification\b/i,
      /\bverify you are (?:a |not a )?human\b/i,
      /\bchecking your browser\b/i
    ]
  }
];

function cleanEvidence(line) {
  return line.replace(/\s+/g, " ").trim();
}

function detectScanSignals(output) {
  const lines = output.split(/\r?\n/).map(cleanEvidence).filter(Boolean);
  const signals = [];

  for (const detector of SCAN_SIGNAL_DETECTORS) {
    const evidence = [];
    for (const line of lines) {
      if (detector.patterns.some((pattern) => pattern.test(line))) {
        evidence.push(line);
        if (evidence.length >= MAX_WARNING_EVIDENCE) break;
      }
    }

    if (evidence.length > 0) {
      signals.push({
        type: detector.type,
        severity: detector.severity,
        message: `Scan output contains ${detector.type.replaceAll("_", " ")} signal(s)`,
        evidence
      });
    }
  }

  return signals;
}

function userFacingDataChanged({ summary, dryRun }) {
  if (dryRun) return false;
  return (summary.newOffersAdded ?? 0) > 0;
}

function shouldPublishAfterScan({ summary, scanSignals, dryRun }) {
  const dataChanged = userFacingDataChanged({ summary, dryRun });
  const signalsNeedSurface = !dryRun && scanSignals.length > 0;

  if (dataChanged) {
    return { required: true, reason: "new_offers_added", dataChanged, signalsNeedSurface };
  }
  if (signalsNeedSurface) {
    return { required: true, reason: "scan_warning_signals", dataChanged, signalsNeedSurface };
  }
  return { required: false, reason: dryRun ? "dry_run" : "no_user_facing_change", dataChanged, signalsNeedSurface };
}

function writeStatus(status) {
  fs.writeFileSync(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

function appendLog(logPath, text) {
  fs.appendFileSync(logPath, text, "utf8");
}

function logScanSignals(logPath, signals) {
  if (signals.length === 0) return;
  appendLog(logPath, "\n## Scan warnings\n");
  for (const signal of signals) {
    const evidence = signal.evidence.length > 0 ? ` (${signal.evidence.join(" | ")})` : "";
    const line = `WARNING: ${signal.message}${evidence}`;
    appendLog(logPath, `${line}\n`);
    console.warn(line);
  }
}

function runStep({ name, command, args, env, logPath }) {
  return new Promise((resolve) => {
    const startedAt = nowIso();
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    appendLog(logPath, `\n## ${name}\n$ ${command} ${args.join(" ")}\n`);

    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      appendLog(logPath, text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code, signal) => {
      const finishedAt = nowIso();
      appendLog(logPath, `\n[${name}] exit=${code ?? "null"} signal=${signal ?? "none"}\n`);
      resolve({ name, command, args, startedAt, finishedAt, code, signal, ok: code === 0, output });
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  ensureDirs();
  acquireLock();

  const startedAt = nowIso();
  const logPath = path.join(LOG_DIR, `${compactTimestamp(startedAt)}.log`);
  const status = {
    state: "running",
    ok: false,
    dryRun: options.dryRun,
    startedAt,
    scanFinishedAt: null,
    finishedAt: null,
    durationMs: null,
    logPath,
    pendingPipelineCount: readPendingPipelineCount(),
    summary: {},
    scanSignals: [],
    warnings: [],
    publish: {
      required: false,
      reason: "not_evaluated",
      dataChanged: false,
      signalsNeedSurface: false,
      skipped: false,
      deployed: false,
      verifyAuth: false,
      verifyBrowser: false
    },
    steps: []
  };
  writeStatus(status);
  appendLog(logPath, `Scythe scheduled run ${startedAt}\n`);

  try {
    const env = brokeredEnv();
    const scanArgs = ["run", "scythe:scan", "--"];
    if (options.dryRun) scanArgs.push("--dry-run");
    if (options.scanVerify) scanArgs.push("--verify");

    const scan = await runStep({ name: "scan", command: "npm", args: scanArgs, env, logPath });
    status.steps.push({ name: scan.name, ok: scan.ok, code: scan.code, startedAt: scan.startedAt, finishedAt: scan.finishedAt });
    status.summary = parseScanSummary(scan.output);
    status.scanSignals = detectScanSignals(scan.output);
    status.warnings = status.scanSignals.map((signal) => signal.message);
    status.publish = {
      ...status.publish,
      ...shouldPublishAfterScan({
        summary: status.summary,
        scanSignals: status.scanSignals,
        dryRun: options.dryRun
      })
    };
    logScanSignals(logPath, status.scanSignals);
    status.pendingPipelineCount = readPendingPipelineCount();
    status.scanFinishedAt = scan.finishedAt;

    if (!scan.ok) {
      status.state = "scan-failed";
      status.ok = false;
      status.error = "scan failed";
    } else {
      status.state = options.dryRun ? "dry-run-scan-ok" : "scan-ok";
      status.ok = true;
    }
    status.durationMs = new Date(scan.finishedAt).getTime() - new Date(scan.startedAt).getTime();
    writeStatus(status);

    if (status.publish.required && !options.skipDeploy) {
      const deploy = await runStep({ name: "deploy", command: "npm", args: ["run", "scythe:web:deploy"], env, logPath });
      status.steps.push({ name: deploy.name, ok: deploy.ok, code: deploy.code, startedAt: deploy.startedAt, finishedAt: deploy.finishedAt });
      status.publish.deployed = deploy.ok;
      if (!deploy.ok) throw new Error("deploy failed");

      const verifyAuth = await runStep({ name: "verify-auth", command: "npm", args: ["run", "scythe:verify:auth"], env, logPath });
      status.steps.push({ name: verifyAuth.name, ok: verifyAuth.ok, code: verifyAuth.code, startedAt: verifyAuth.startedAt, finishedAt: verifyAuth.finishedAt });
      status.publish.verifyAuth = verifyAuth.ok;
      if (!verifyAuth.ok) throw new Error("authenticated HTTP verification failed");

      if (!options.skipBrowser) {
        const verifyBrowser = await runStep({ name: "verify-browser", command: "npm", args: ["run", "scythe:verify:browser"], env, logPath });
        status.steps.push({ name: verifyBrowser.name, ok: verifyBrowser.ok, code: verifyBrowser.code, startedAt: verifyBrowser.startedAt, finishedAt: verifyBrowser.finishedAt });
        status.publish.verifyBrowser = verifyBrowser.ok;
        if (!verifyBrowser.ok) throw new Error("authenticated browser verification failed");
      }
    } else {
      status.publish.skipped = true;
      if (options.skipDeploy && status.publish.required) status.publish.reason = `${status.publish.reason}_skip_deploy`;
      appendLog(logPath, `\nDeploy skipped: ${status.publish.reason}\n`);
    }

    if (!scan.ok) throw new Error("scan failed");

    if (status.scanSignals.length > 0) {
      status.state = options.dryRun ? "dry-run-ok-with-warnings" : "ok-with-warnings";
    } else {
      status.state = options.dryRun ? "dry-run-ok" : "ok";
    }
    status.ok = true;
  } catch (error) {
    status.state = "failed";
    status.ok = false;
    status.error = error.message;
    appendLog(logPath, `\nFAILED: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    status.finishedAt = nowIso();
    status.durationMs = new Date(status.finishedAt).getTime() - new Date(status.startedAt).getTime();
    status.pendingPipelineCount = readPendingPipelineCount();
    writeStatus(status);
    releaseLock();
  }

  console.log(`state=${status.state}`);
  console.log(`new_offers=${status.summary.newOffersAdded ?? "unknown"}`);
  console.log(`scan_warnings=${status.scanSignals.length}`);
  console.log(`publish=${status.publish.required ? status.publish.reason : "skipped"}`);
  console.log(`pending_pipeline=${status.pendingPipelineCount}`);
  console.log(`log=${logPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`scythe-scheduled-run: ${error.message}`);
    process.exit(1);
  });
}

export {
  detectScanSignals,
  parseScanSummary,
  shouldPublishAfterScan,
  userFacingDataChanged
};
