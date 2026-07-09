#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG = "config/cloudflare-access.scythe.json";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Run: eval "$(npm run --silent scythe:env)"`);
  return value;
}

async function verify() {
  const config = readJson(process.argv[2] || DEFAULT_CONFIG);
  const url = process.env.SCYTHE_URL || `https://${config.domain}`;
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
      "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET")
    }
  });

  console.log(`URL: ${url}`);
  console.log(`HTTPS status: ${response.status}`);
  console.log(`Server: ${response.headers.get("server") || "(missing)"}`);
  console.log(`Content-Type: ${response.headers.get("content-type") || "(missing)"}`);
  console.log(`Location: ${response.headers.get("location") || "(none)"}`);

  if (response.status !== 200) {
    throw new Error(`Expected authenticated status 200, got ${response.status}.`);
  }

  const html = await response.text();
  const appSignals = ["candidate-list", "Queue", "Saved"];
  if (!appSignals.some((signal) => html.includes(signal))) {
    throw new Error("Authenticated response did not contain expected Scythe app markers.");
  }

  console.log("Authenticated access: ok");
}

verify().catch((error) => {
  console.error(`scythe-verify-auth: ${error.message}`);
  process.exit(1);
});
