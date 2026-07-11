#!/usr/bin/env node

/**
 * Focused BEST/ALL inbox proof for Scythe.
 *
 * Run: node scythe-best-all.test.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

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

function withTempRoot(fn) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scythe-best-all-"));
  const originalCwd = process.cwd();
  const originalRoot = process.env.SCYTHE_ROOT;
  try {
    fs.mkdirSync(path.join(tempRoot, "data"), { recursive: true });
    process.env.SCYTHE_ROOT = tempRoot;
    return fn(tempRoot);
  } finally {
    if (originalRoot === undefined) delete process.env.SCYTHE_ROOT;
    else process.env.SCYTHE_ROOT = originalRoot;
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const scan = await import(pathToFileURL(path.join(ROOT, "scan.mjs")).href);
const scythe = await import(pathToFileURL(path.join(ROOT, "scythe-web/src/lib/scythe.ts")).href);

test("BEST is exactly pipeline.md while ALL includes excluded scan candidates", () => {
  withTempRoot((tempRoot) => {
    fs.writeFileSync(
      path.join(tempRoot, "data", "pipeline.md"),
      `# Pipeline -- Pending URLs

## Pending

- [ ] https://best.example/1 | BestCo | Contract AI Engineer | Remote | note: paid trial
- [ ] https://best.example/2 | FlowCo | Workflow Consultant | EMEA

## Processed
`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(tempRoot, "data", "scythe-excluded-candidates.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        candidates: [
          {
            url: "https://excluded.example/1",
            source: "ashby-api",
            company: "ExcludedCo",
            title: "Director of Sales",
            location: "Remote US",
            reason: "title",
          },
          {
            url: "https://best.example/1",
            source: "ashby-api",
            company: "DuplicateBest",
            title: "Duplicate Pipeline Role",
            location: "Remote",
            reason: "duplicate_url",
          },
        ],
      }, null, 2)}\n`,
      "utf8",
    );

    const data = scythe.readDashboardData();

    assert.deepEqual(
      data.candidates.map((candidate) => candidate.url).sort(),
      ["https://best.example/1", "https://best.example/2"],
    );
    assert.equal(data.candidates.some((candidate) => candidate.excluded), false);

    const allByUrl = new Map(data.allCandidates.map((candidate) => [candidate.url, candidate]));
    assert.equal(data.allCandidates.length, 3);
    assert.equal(allByUrl.get("https://excluded.example/1")?.excluded, true);
    assert.equal(allByUrl.get("https://excluded.example/1")?.exclusionReason, "title");
    assert.equal(allByUrl.get("https://best.example/1")?.excluded, false);
  });
});

test("scanner writes excluded artifact without appending excluded jobs to pipeline.md", () => {
  withTempRoot((tempRoot) => {
    process.chdir(tempRoot);

    scan.appendToPipeline([
      { url: "https://best.example/1", company: "BestCo", title: "AI Contractor", location: "Remote" },
    ]);

    const result = scan.writeExcludedCandidatesArtifact([
      {
        url: "https://excluded.example/1",
        source: "lever-api",
        company: "ExcludedCo",
        title: "Onsite Director",
        location: "New York",
        exclusionReason: "location",
      },
      {
        url: "https://excluded.example/1",
        source: "lever-api",
        company: "ExcludedCo Duplicate",
        title: "Duplicate",
        location: "New York",
        exclusionReason: "title",
      },
      {
        url: "https://dupe.example/1",
        source: "lever-api",
        company: "AlreadySeenCo",
        title: "Known Role",
        location: "Remote",
        exclusionReason: "duplicate_url",
      },
    ]);

    const pipeline = fs.readFileSync(path.join(tempRoot, "data", "pipeline.md"), "utf8");
    assert.match(pipeline, /https:\/\/best\.example\/1/);
    assert.doesNotMatch(pipeline, /https:\/\/excluded\.example\/1/);

    const artifact = JSON.parse(fs.readFileSync(path.join(tempRoot, result.path), "utf8"));
    assert.equal(result.changed, true);
    assert.equal(artifact.candidates.length, 1);
    assert.equal(artifact.candidates[0].url, "https://excluded.example/1");
    assert.equal(artifact.candidates[0].reason, "title");
    assert.equal(artifact.candidates.some((candidate) => candidate.url === "https://dupe.example/1"), false);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failures:", failures.join(", "));
  process.exit(1);
}
