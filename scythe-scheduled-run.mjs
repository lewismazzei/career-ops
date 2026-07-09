#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOG_DIR = "logs/scythe-scheduler";
const STATUS_PATH = "data/scythe-scheduler-status.json";
const LOCK_PATH = "data/scythe-scheduler.lock";
const STALE_LOCK_MS = 3 * 60 * 60 * 1000;

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

function writeStatus(status) {
  fs.writeFileSync(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

function appendLog(logPath, text) {
  fs.appendFileSync(logPath, text, "utf8");
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
    finishedAt: null,
    durationMs: null,
    logPath,
    pendingPipelineCount: readPendingPipelineCount(),
    summary: {},
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
    status.pendingPipelineCount = readPendingPipelineCount();

    if (!scan.ok) throw new Error("scan failed");

    if (!options.dryRun && !options.skipDeploy) {
      const deploy = await runStep({ name: "deploy", command: "npm", args: ["run", "scythe:web:deploy"], env, logPath });
      status.steps.push({ name: deploy.name, ok: deploy.ok, code: deploy.code, startedAt: deploy.startedAt, finishedAt: deploy.finishedAt });
      if (!deploy.ok) throw new Error("deploy failed");

      const verifyAuth = await runStep({ name: "verify-auth", command: "npm", args: ["run", "scythe:verify:auth"], env, logPath });
      status.steps.push({ name: verifyAuth.name, ok: verifyAuth.ok, code: verifyAuth.code, startedAt: verifyAuth.startedAt, finishedAt: verifyAuth.finishedAt });
      if (!verifyAuth.ok) throw new Error("authenticated HTTP verification failed");

      if (!options.skipBrowser) {
        const verifyBrowser = await runStep({ name: "verify-browser", command: "npm", args: ["run", "scythe:verify:browser"], env, logPath });
        status.steps.push({ name: verifyBrowser.name, ok: verifyBrowser.ok, code: verifyBrowser.code, startedAt: verifyBrowser.startedAt, finishedAt: verifyBrowser.finishedAt });
        if (!verifyBrowser.ok) throw new Error("authenticated browser verification failed");
      }
    }

    status.state = options.dryRun ? "dry-run-ok" : "ok";
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
  console.log(`pending_pipeline=${status.pendingPipelineCount}`);
  console.log(`log=${logPath}`);
}

main().catch((error) => {
  console.error(`scythe-scheduled-run: ${error.message}`);
  process.exit(1);
});
