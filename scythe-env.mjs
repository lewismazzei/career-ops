#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const SECRET_REFS = {
  CLOUDFLARE_API_TOKEN: "cloudflare/scythe/access-admin-token",
  CF_ACCESS_CLIENT_ID: "cloudflare/scythe/access-service-client-id",
  CF_ACCESS_CLIENT_SECRET: "cloudflare/scythe/access-service-client-secret"
};

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function readPass(name) {
  return execFileSync("pass", ["show", name], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function printExports() {
  for (const [envName, passName] of Object.entries(SECRET_REFS)) {
    const value = readPass(passName);
    if (!value) throw new Error(`pass entry is empty: ${passName}`);
    console.log(`export ${envName}=${shellQuote(value)}`);
  }
}

function usage() {
  console.log("Usage:");
  console.log("  node scythe-env.mjs exports");
}

function main() {
  const command = process.argv[2] || "exports";
  if (command === "exports") {
    printExports();
    return;
  }

  usage();
  process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(`scythe-env: ${error.message}`);
  process.exit(1);
}
