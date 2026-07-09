#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';

const files = {
  config: 'config/scythe.yml',
  opportunities: 'data/opportunities.md',
  saved: 'data/saved.md',
  targets: 'data/targets.md',
  conversations: 'data/conversations.md',
  portals: 'portals.yml',
};

const starters = {
  [files.config]: `# Local Scythe pilot configuration. This file is gitignored.

objective: "paid remote work acquisition"

pilot:
  window_days: 14
  primary_metric: "qualified paid-work conversations"
  priority: "time to cash"
  manual_send_only: true
  pre_contact_research_minutes: 25

remote_policy:
  execution_required: true
  timezone_overlap: "negotiable"
  travel: "exceptional only"
  reject_regular_onsite: false

work_hierarchy:
  - id: fast-paid-remote
    label: "Fast paid remote work"
    priority: 1
  - id: software-contract
    label: "Software-adjacent contract work"
    priority: 2
  - id: agent-leveraged-knowledge-work
    label: "Agent-leveraged knowledge work in any domain"
    priority: 3
  - id: v0-launch
    label: "Idea to first real customer"
    priority: 4
  - id: generic-remote
    label: "Generic remote work when economics or strategy justify it"
    priority: 5
`,
  [files.opportunities]: `# Opportunities Tracker

| # | Date | Source | Category | Target/Company | Opportunity | Remote Class | Agent Leverage | Proof Match | Next Action | Status | Outcome | Notes |
|---|------|--------|----------|----------------|-------------|--------------|----------------|-------------|-------------|--------|---------|-------|
`,
  [files.saved]: `# Saved Opportunities

Use this for roles, buyers, JDs, and work shapes that are attractive but not part of the immediate cash-first queue. Typical reasons: underqualified today, too slow, too strategic, needs proof-building, or worth revisiting after a concrete trigger.

| # | Date Saved | Source | Target/Company | Opportunity | Why Saved | Gap To Close | Revisit Trigger | Notes |
|---|------------|--------|----------------|-------------|-----------|--------------|-----------------|-------|
`,
  [files.targets]: `# Targets Tracker

| # | Date | Source | Target | Buyer Hypothesis | Pain Signal | Execution Gap | Likely Offer | Next Action | Status | Outcome | Notes |
|---|------|--------|--------|------------------|-------------|---------------|--------------|-------------|--------|---------|-------|
`,
  [files.conversations]: `# Conversations Tracker

| # | Date | Opportunity/Target | Contact | Channel | State | Next Step | Follow-Up Date | Outcome | Notes |
|---|------|--------------------|---------|---------|-------|-----------|----------------|---------|-------|
`,
};

function help() {
  console.log(`Scythe helper

Usage:
  node scythe.mjs init
  node scythe.mjs status
  node scythe.mjs scan [scan.mjs args...]

Examples:
  node scythe.mjs scan --dry-run
  node scythe.mjs scan --verify
`);
}

function ensureFile(path, content) {
  if (existsSync(path)) return { path, status: 'exists' };
  const slash = path.lastIndexOf('/');
  if (slash > -1) mkdirSync(path.slice(0, slash), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return { path, status: 'created' };
}

function init() {
  mkdirSync('briefs', { recursive: true });
  const results = [
    ensureFile(files.config, starters[files.config]),
    ensureFile(files.opportunities, starters[files.opportunities]),
    ensureFile(files.saved, starters[files.saved]),
    ensureFile(files.targets, starters[files.targets]),
    ensureFile(files.conversations, starters[files.conversations]),
  ];

  if (!existsSync(files.portals)) {
    const template = existsSync('templates/portals.scythe.example.yml') ? readFileSync('templates/portals.scythe.example.yml', 'utf8') : '';
    results.push(ensureFile(files.portals, template));
  } else {
    results.push({ path: files.portals, status: 'exists' });
  }

  for (const result of results) console.log(`${result.status}: ${result.path}`);
}

function markdownRows(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('|') && !line.includes('---') && !line.startsWith('| # |'))
    .map(line => line.split('|').map(cell => cell.trim()).filter(Boolean));
}

function countBy(rows, index) {
  const counts = new Map();
  for (const row of rows) {
    const key = row[index] || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function printCounts(label, counts) {
  if (counts.size === 0) return;
  console.log(label);
  for (const [key, value] of [...counts.entries()].sort()) console.log(`  ${key}: ${value}`);
}

function status() {
  const opportunities = markdownRows(files.opportunities);
  const saved = markdownRows(files.saved);
  const targets = markdownRows(files.targets);
  const conversations = markdownRows(files.conversations);

  console.log('Scythe status');
  console.log(`  opportunities: ${opportunities.length}`);
  console.log(`  saved: ${saved.length}`);
  console.log(`  targets: ${targets.length}`);
  console.log(`  conversations: ${conversations.length}`);

  printCounts('\nOpportunity status', countBy(opportunities, 10));
  printCounts('\nOpportunity outcomes', countBy(opportunities, 11));
  printCounts('\nTarget status', countBy(targets, 9));
  printCounts('\nConversation state', countBy(conversations, 5));
}

function scan(args) {
  const child = spawn(process.execPath, ['scan.mjs', ...args], { stdio: 'inherit', env: { ...process.env, SCYTHE_SCAN: '1' } });
  child.on('exit', code => process.exit(code ?? 1));
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'init':
    init();
    break;
  case 'status':
    status();
    break;
  case 'scan':
    scan(args);
    break;
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    help();
    process.exit(1);
}
