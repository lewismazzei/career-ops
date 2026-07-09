#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_CONFIG = "config/cloudflare-access.scythe.json";
const DEFAULT_SCREENSHOT = "reports/scythe-auth-browser.png";

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
  const screenshotPath = path.resolve(process.env.SCYTHE_SCREENSHOT || DEFAULT_SCREENSHOT);
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "CF-Access-Client-Id": requiredEnv("CF_ACCESS_CLIENT_ID"),
        "CF-Access-Client-Secret": requiredEnv("CF_ACCESS_CLIENT_SECRET")
      },
      viewport: {
        width: Number(process.env.SCYTHE_VIEWPORT_WIDTH || 412),
        height: Number(process.env.SCYTHE_VIEWPORT_HEIGHT || 915)
      },
      deviceScaleFactor: Number(process.env.SCYTHE_DEVICE_SCALE_FACTOR || 2),
      isMobile: true,
      hasTouch: true
    });

    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle" });
    const status = response?.status() || 0;
    const metrics = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      bodyText: document.body.innerText.slice(0, 500)
    }));

    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`URL: ${metrics.url}`);
    console.log(`HTTPS status: ${status}`);
    console.log(`Title: ${metrics.title || "(missing)"}`);
    console.log(`Horizontal overflow: ${metrics.horizontalOverflow ? "yes" : "no"}`);
    console.log(`Screenshot: ${screenshotPath}`);

    if (status !== 200) throw new Error(`Expected browser status 200, got ${status}.`);
    const lowerBodyText = metrics.bodyText.toLowerCase();
    if (!lowerBodyText.includes("queue") || !lowerBodyText.includes("saved")) {
      throw new Error("Browser response did not contain expected Scythe navigation.");
    }
    if (metrics.horizontalOverflow) throw new Error("Browser viewport has horizontal overflow.");

    console.log("Authenticated browser access: ok");
  } catch (error) {
    if (String(error.message || error).includes("error while loading shared libraries")) {
      throw new Error("Playwright Chromium cannot launch because the VPS is missing browser system libraries. On Ubuntu 24.04, install the observed missing libraries with: sudo apt-get update && sudo apt-get install -y libnspr4 libnss3 libasound2t64");
    }
    throw error;
  } finally {
    await browser?.close();
  }
}

verify().catch((error) => {
  console.error(`scythe-verify-browser: ${error.message}`);
  process.exit(1);
});
