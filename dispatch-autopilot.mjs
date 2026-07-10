#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_CONFIG = "config/dispatch-autopilot.scythe.json";
const DEFAULT_STATE_DIR = "logs/dispatch-autopilot";

function usage() {
  console.log(`Usage:
  node dispatch-autopilot.mjs plan [--config PATH]
  node dispatch-autopilot.mjs adopt --worker NAME [--config PATH]
  node dispatch-autopilot.mjs spawn --task TEXT --owner TEXT [--avoid TEXT] [--background] [--config PATH]
  node dispatch-autopilot.mjs once [--apply] [--deploy] [--push] [--config PATH]

Dispatch autopilot is conservative by default:
  - workers are ignored unless adopted
  - plan is read-only
  - once requires --apply to integrate
  - deploy and push require both config enablement and CLI flags`);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return {
      command: argv.length === 0 ? "plan" : "help",
      config: DEFAULT_CONFIG,
      apply: false,
      deploy: false,
      push: false,
      background: false,
      worker: "",
      task: "",
      owner: "",
      avoid: ""
    };
  }

  const options = {
    command: argv[0] || "plan",
    config: DEFAULT_CONFIG,
    apply: false,
    deploy: false,
    push: false,
    background: false,
    worker: "",
    task: "",
    owner: "",
    avoid: ""
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.command = "help";
    else if (arg === "--config") options.config = argv[++i] || "";
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--deploy") options.deploy = true;
    else if (arg === "--push") options.push = true;
    else if (arg === "--background") options.background = true;
    else if (arg === "--worker") options.worker = argv[++i] || "";
    else if (arg === "--task") options.task = argv[++i] || "";
    else if (arg === "--owner") options.owner = argv[++i] || "";
    else if (arg === "--avoid") options.avoid = argv[++i] || "";
    else throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function absoluteFromRoot(value) {
  const expanded = expandHome(value);
  return path.isAbsolute(expanded) ? expanded : path.resolve(ROOT, expanded);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadConfig(filePath) {
  const configPath = absoluteFromRoot(filePath);
  const config = readJson(configPath);
  const stateDir = absoluteFromRoot(config.stateDir || DEFAULT_STATE_DIR);
  const dispatchRoot = absoluteFromRoot(config.dispatchRoot || "~/.codex/dispatch");
  const targetRepo = absoluteFromRoot(config.targetRepo || ROOT);
  return {
    ...config,
    configPath,
    stateDir,
    dispatchRoot,
    targetRepo,
    targetBranch: config.targetBranch || "pilot",
    pushRemote: config.pushRemote || "",
    pushBranch: config.pushBranch || config.targetBranch || "pilot",
    allowDirtyWorkerCommit: config.allowDirtyWorkerCommit !== false,
    requireAdopted: config.requireAdopted !== false,
    dispatchCreateScript: absoluteFromRoot(config.dispatchCreateScript || "~/.agents/skills/dispatch/scripts/dispatch-create.zsh"),
    dispatchStateScript: absoluteFromRoot(config.dispatchStateScript || "~/.agents/skills/dispatch/scripts/dispatch-state.zsh"),
    codexCommand: config.codexCommand || "codex",
    allowedPaths: config.allowedPaths || [],
    blockedPaths: config.blockedPaths || [],
    checks: config.checks || [],
    deploySteps: config.deploySteps || [],
    verifySteps: config.verifySteps || [],
    allowDeploy: Boolean(config.allowDeploy),
    allowPush: Boolean(config.allowPush),
    autoCleanupIntegration: config.autoCleanupIntegration !== false
  };
}

function nowIso() {
  return new Date().toISOString();
}

function compactTimestamp(iso = nowIso()) {
  return iso.replaceAll(":", "").replaceAll("-", "").replace(/\.\d{3}Z$/, "Z");
}

function ensureState(config) {
  fs.mkdirSync(config.stateDir, { recursive: true });
}

function writeStatus(config, status) {
  ensureState(config);
  fs.writeFileSync(path.join(config.stateDir, "status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

function audit(config, event) {
  ensureState(config);
  const record = { time: nowIso(), ...event };
  fs.appendFileSync(path.join(config.stateDir, "events.ndjson"), `${JSON.stringify(record)}\n`, "utf8");
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${value}\n`, "utf8");
}

function workerDir(config, worker) {
  return path.join(config.dispatchRoot, "workers", worker);
}

function workerState(workerPath) {
  const statePath = path.join(workerPath, "state.json");
  if (fs.existsSync(statePath)) return readJson(statePath);
  return {
    name: readText(path.join(workerPath, "name")),
    status: readText(path.join(workerPath, "status")),
    repo: readText(path.join(workerPath, "repo")),
    worktree: readText(path.join(workerPath, "worktree")),
    branch: readText(path.join(workerPath, "branch")),
    task: readText(path.join(workerPath, "task")),
    owner: readText(path.join(workerPath, "owner")),
    avoid: readText(path.join(workerPath, "avoid"))
  };
}

function listWorkers(config) {
  const workersRoot = path.join(config.dispatchRoot, "workers");
  if (!fs.existsSync(workersRoot)) return [];
  return fs.readdirSync(workersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(workersRoot, entry.name);
      return { dir, ...workerState(dir) };
    });
}

function isAdopted(worker) {
  return readText(path.join(worker.dir, "autopilot")) === "yes";
}

function markAdopted(config, workerName) {
  const dir = workerDir(config, workerName);
  if (!fs.existsSync(dir)) throw new Error(`unknown worker: ${workerName}`);
  writeText(path.join(dir, "autopilot"), "yes");
  appendWorkerEvent(dir, "autopilot-adopted", "worker adopted by dispatch autopilot");
  audit(config, { type: "adopted", worker: workerName });
  console.log(`adopted=${workerName}`);
}

function appendWorkerEvent(workerPath, type, message) {
  const record = { time: nowIso(), type, message };
  fs.appendFileSync(path.join(workerPath, "events.ndjson"), `${JSON.stringify(record)}\n`, "utf8");
}

function dispatchState(config, worker, status, message) {
  spawnSync(config.dispatchStateScript, ["--worker", worker, "--status", status, "--message", message], {
    cwd: config.targetRepo,
    env: { ...process.env, CODEX_DISPATCH_HOME: config.dispatchRoot },
    stdio: "inherit"
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout || ""}${result.stderr || ""}`.trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout || "";
}

function runShell(step, cwd, logPath) {
  const startedAt = nowIso();
  fs.appendFileSync(logPath, `\n## ${step.name}\n$ ${step.command}\n`, "utf8");
  const result = spawnSync(step.shell || "zsh", ["-lc", step.command], {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  fs.appendFileSync(logPath, result.stdout || "", "utf8");
  fs.appendFileSync(logPath, result.stderr || "", "utf8");
  fs.appendFileSync(logPath, `\n[${step.name}] exit=${result.status ?? "null"} signal=${result.signal ?? "none"}\n`, "utf8");
  return { name: step.name, ok: result.status === 0, code: result.status, startedAt, finishedAt: nowIso() };
}

function git(cwd, args, capture = false) {
  return run("git", args, { cwd, capture });
}

function currentBranch(repo) {
  return git(repo, ["branch", "--show-current"], true).trim();
}

function isClean(repo) {
  return git(repo, ["status", "--porcelain"], true).trim() === "";
}

function pathMatches(pattern, filePath) {
  if (pattern.endsWith("/**")) return filePath === pattern.slice(0, -3) || filePath.startsWith(pattern.slice(0, -3));
  if (pattern.endsWith("/")) return filePath.startsWith(pattern);
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
    return new RegExp(`^${escaped}$`).test(filePath);
  }
  return filePath === pattern || filePath.startsWith(`${pattern}/`);
}

function allowedByPolicy(config, filePath) {
  if (config.blockedPaths.some((pattern) => pathMatches(pattern, filePath))) return false;
  if (config.allowedPaths.length === 0) return true;
  return config.allowedPaths.some((pattern) => pathMatches(pattern, filePath));
}

function assertPathPolicy(config, paths, workerName) {
  const bad = [...new Set(paths)].filter((filePath) => !allowedByPolicy(config, filePath));
  if (bad.length > 0) {
    throw new Error(`worker ${workerName} touched paths outside autopilot policy: ${bad.join(", ")}`);
  }
}

function statusPaths(worktree) {
  const lines = git(worktree, ["status", "--porcelain"], true).split(/\r?\n/).filter(Boolean);
  return lines.flatMap((line) => {
    const raw = line.slice(3).trim();
    if (raw.includes(" -> ")) return raw.split(" -> ").map((part) => part.trim()).filter(Boolean);
    return [raw].filter(Boolean);
  });
}

function changedPaths(repo, targetBranch, branch) {
  return git(repo, ["diff", "--name-only", `${targetBranch}...${branch}`], true).split(/\r?\n/).filter(Boolean);
}

function validateResult(worker) {
  const resultPath = path.join(worker.dir, "result.md");
  const result = readText(resultPath);
  if (!result) throw new Error(`worker ${worker.name} has no result.md`);
  if (/Status:\s*pending/i.test(result)) throw new Error(`worker ${worker.name} result.md is still pending`);
  if (/pending \| pending \| pending/i.test(result)) throw new Error(`worker ${worker.name} proof matrix is still pending`);
}

function commitDirtyWorker(config, worker) {
  const paths = statusPaths(worker.worktree);
  if (paths.length === 0) return null;
  if (!config.allowDirtyWorkerCommit) throw new Error(`worker ${worker.name} has dirty changes`);
  assertPathPolicy(config, paths, worker.name);
  git(worker.worktree, ["add", "--", ...paths]);
  git(worker.worktree, ["commit", "-m", `chore(dispatch): finish ${worker.name}`]);
  return paths;
}

function makeIntegration(config, worker) {
  const stamp = compactTimestamp();
  const integrationBranch = `dispatch-autopilot/${worker.name}-${stamp}`;
  const integrationWorktree = path.join(path.dirname(config.targetRepo), `${path.basename(config.targetRepo)}-autopilot-${worker.name}-${stamp}`);
  git(config.targetRepo, ["worktree", "add", "-b", integrationBranch, integrationWorktree, config.targetBranch]);
  return { integrationBranch, integrationWorktree };
}

function removeIntegration(config, integration) {
  if (!integration?.integrationWorktree) return;
  try {
    git(config.targetRepo, ["worktree", "remove", integration.integrationWorktree]);
  } catch (error) {
    audit(config, { type: "cleanup-failed", integration: integration.integrationWorktree, error: error.message });
  }
  try {
    git(config.targetRepo, ["branch", "-d", integration.integrationBranch]);
  } catch (error) {
    audit(config, { type: "branch-cleanup-failed", branch: integration.integrationBranch, error: error.message });
  }
}

function eligibleWorkers(config) {
  return listWorkers(config).filter((worker) => {
    if (worker.status !== "ready") return false;
    if (path.resolve(worker.repo || "") !== path.resolve(config.targetRepo)) return false;
    if (config.requireAdopted && !isAdopted(worker)) return false;
    return true;
  });
}

function plan(config) {
  const allWorkers = listWorkers(config);
  const targetWorkers = allWorkers.filter((worker) => path.resolve(worker.repo || "") === path.resolve(config.targetRepo));
  const workers = targetWorkers.map((worker) => ({
    name: worker.name,
    status: worker.status,
    adopted: isAdopted(worker),
    repo: worker.repo,
    branch: worker.branch,
    eligible: worker.status === "ready" && path.resolve(worker.repo || "") === path.resolve(config.targetRepo) && (!config.requireAdopted || isAdopted(worker))
  }));
  console.log(JSON.stringify({ config: config.configPath, targetRepo: config.targetRepo, targetBranch: config.targetBranch, ignoredOtherRepos: allWorkers.length - targetWorkers.length, workers }, null, 2));
}

function processWorker(config, worker, options) {
  const startedAt = nowIso();
  const logPath = path.join(config.stateDir, `${compactTimestamp(startedAt)}-${worker.name}.log`);
  const steps = [];
  let integration = null;

  const status = {
    worker: worker.name,
    state: "running",
    ok: false,
    startedAt,
    finishedAt: null,
    logPath,
    steps,
    targetBranch: config.targetBranch,
    workerBranch: worker.branch
  };
  writeStatus(config, status);
  audit(config, { type: "worker-start", worker: worker.name, branch: worker.branch });

  try {
    if (!options.apply) {
      status.state = "planned";
      status.ok = true;
      status.changedPaths = changedPaths(config.targetRepo, config.targetBranch, worker.branch);
      writeStatus(config, status);
      console.log(`planned=${worker.name}`);
      return status;
    }

    if (currentBranch(config.targetRepo) !== config.targetBranch) throw new Error(`source repo must be on ${config.targetBranch}`);
    if (!isClean(config.targetRepo)) throw new Error("source repo is dirty");
    validateResult(worker);

    const targetBefore = git(config.targetRepo, ["rev-parse", config.targetBranch], true).trim();
    const committedPaths = commitDirtyWorker(config, worker);
    const diffPaths = changedPaths(config.targetRepo, config.targetBranch, worker.branch);
    assertPathPolicy(config, diffPaths, worker.name);

    integration = makeIntegration(config, worker);
    git(integration.integrationWorktree, ["merge", "--no-ff", "--no-edit", worker.branch]);

    for (const step of config.checks) {
      const proof = runShell(step, integration.integrationWorktree, logPath);
      steps.push(proof);
      if (!proof.ok) throw new Error(`check failed: ${step.name}`);
      writeStatus(config, status);
    }

    if (options.deploy) {
      if (!config.allowDeploy) throw new Error("deploy requested but config allowDeploy is false");
      for (const step of [...config.deploySteps, ...config.verifySteps]) {
        const proof = runShell(step, integration.integrationWorktree, logPath);
        steps.push(proof);
        if (!proof.ok) throw new Error(`deploy/verify failed: ${step.name}`);
        writeStatus(config, status);
      }
    }

    const targetNow = git(config.targetRepo, ["rev-parse", config.targetBranch], true).trim();
    if (targetNow !== targetBefore) throw new Error(`${config.targetBranch} moved during integration`);
    git(config.targetRepo, ["merge", "--ff-only", integration.integrationBranch]);

    if (options.push) {
      if (!config.allowPush) throw new Error("push requested but config allowPush is false");
      if (!config.pushRemote) throw new Error("push requested but pushRemote is not configured");
      git(config.targetRepo, ["push", config.pushRemote, `${config.targetBranch}:${config.pushBranch}`]);
    }

    dispatchState(config, worker.name, "integrated", "dispatch autopilot integrated worker");
    status.state = options.deploy ? "deployed" : "integrated";
    status.ok = true;
    status.targetBefore = targetBefore;
    status.targetAfter = git(config.targetRepo, ["rev-parse", config.targetBranch], true).trim();
    status.changedPaths = diffPaths;
    status.committedDirtyWorkerPaths = committedPaths || [];
    audit(config, { type: status.state, worker: worker.name, targetAfter: status.targetAfter });
    return status;
  } catch (error) {
    status.state = "blocked";
    status.ok = false;
    status.error = error.message;
    dispatchState(config, worker.name, "blocked", `dispatch autopilot blocked: ${error.message}`);
    audit(config, { type: "blocked", worker: worker.name, error: error.message });
    return status;
  } finally {
    if (config.autoCleanupIntegration && integration) removeIntegration(config, integration);
    status.finishedAt = nowIso();
    writeStatus(config, status);
  }
}

function once(config, options) {
  ensureState(config);
  const workers = eligibleWorkers(config);
  if (workers.length === 0) {
    const status = { state: "idle", ok: true, finishedAt: nowIso(), workers: 0 };
    writeStatus(config, status);
    console.log("eligible_workers=0");
    return;
  }
  for (const worker of workers) {
    const status = processWorker(config, worker, options);
    console.log(`${worker.name}=${status.state}`);
    if (!status.ok) process.exitCode = 1;
  }
}

function createWorker(config, options) {
  if (!options.task) throw new Error("--task is required");
  if (!options.owner) throw new Error("--owner is required");
  const args = ["--repo", config.targetRepo, "--base", config.targetBranch, "--task", options.task, "--owner", options.owner];
  if (options.avoid) args.push("--avoid", options.avoid);
  const output = execFileSync(config.dispatchCreateScript, args, { cwd: config.targetRepo, env: { ...process.env, CODEX_DISPATCH_HOME: config.dispatchRoot }, encoding: "utf8" });
  process.stdout.write(output);
  const fields = Object.fromEntries(output.trim().split(/\r?\n/).map((line) => line.split("=")).filter((parts) => parts.length >= 2).map(([key, ...rest]) => [key, rest.join("=")]));
  if (!fields.name || !fields.worktree) throw new Error("dispatch-create output did not include name/worktree");
  markAdopted(config, fields.name);
  return fields;
}

function workerPrompt(fields, options) {
  return `You are a Codex dispatch worker for Scythe.

Worktree: ${fields.worktree}
Worker: ${fields.name}
Branch: ${fields.branch}
Task: ${options.task}
Ownership: ${options.owner}
Do not touch: ${options.avoid || "outside the ownership scope"}

Rules:
- Run commands from ${fields.worktree}.
- Read .codex/dispatch/request.md before editing.
- You are not alone in the codebase. Do not revert edits made by others.
- Stay within ownership. If broader edits are required, mark blocked.
- Use apply_patch for manual edits.
- Do not clean up the worktree.
- Do not commit; dispatch autopilot will commit dirty worker changes after policy checks.
- Before finishing, write .codex/dispatch/result.md with acceptance contract, proof matrix, checks run, changed paths, risks, and remaining work.
- Mark ready with: /home/lewis/.agents/skills/dispatch/scripts/dispatch-state.zsh --worker ${fields.name} --status ready --message "ready for autopilot integration"
- If blocked, mark blocked with the same script and a concrete reason.`;
}

function spawnCodex(config, fields, options) {
  const prompt = workerPrompt(fields, options);
  const logPath = path.join(config.stateDir, `${compactTimestamp()}-${fields.name}-codex.log`);
  ensureState(config);
  const args = ["exec", "--cd", fields.worktree, "--sandbox", "danger-full-access", "--ask-for-approval", "never", prompt];

  if (!options.background) {
    const result = spawnSync(config.codexCommand, args, { cwd: fields.worktree, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`codex exec failed with ${result.status}`);
    return;
  }

  const fd = fs.openSync(logPath, "a");
  const child = spawn(config.codexCommand, args, {
    cwd: fields.worktree,
    detached: true,
    stdio: ["ignore", fd, fd]
  });
  child.unref();
  fs.closeSync(fd);
  writeText(path.join(workerDir(config, fields.name), "codex_pid"), String(child.pid));
  writeText(path.join(workerDir(config, fields.name), "codex_log"), logPath);
  dispatchState(config, fields.name, "running", `codex exec spawned pid ${child.pid}`);
  console.log(`codex_pid=${child.pid}`);
  console.log(`codex_log=${logPath}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    usage();
    return;
  }

  const config = loadConfig(options.config);

  if (options.command === "plan") return plan(config);
  if (options.command === "adopt") {
    if (!options.worker) throw new Error("--worker is required");
    return markAdopted(config, options.worker);
  }
  if (options.command === "once") return once(config, options);
  if (options.command === "spawn") {
    const fields = createWorker(config, options);
    return spawnCodex(config, fields, options);
  }
  throw new Error(`unknown command: ${options.command}`);
}

main().catch((error) => {
  console.error(`dispatch-autopilot: ${error.message}`);
  process.exit(1);
});
