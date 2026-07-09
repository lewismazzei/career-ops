#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_CONFIG = "config/cloudflare-access.scythe.json";

function usage() {
  console.log(`Usage:
  node scythe-cloudflare-access.mjs plan [--config PATH]
  node scythe-cloudflare-access.mjs apply [--config PATH] [--create-zone] [--skip-dns]
  node scythe-cloudflare-access.mjs status [--config PATH]
  node scythe-cloudflare-access.mjs verify [--config PATH]

Environment:
  CLOUDFLARE_API_TOKEN  Required for apply/status.
  CLOUDFLARE_ACCOUNT_ID Optional if the token can list exactly one account.
  CLOUDFLARE_ZONE_ID    Optional if the token can find the zone by domain.

The script stores newly-created Access service-token credentials in pass. It converges Cloudflare DNS + Access state from the JSON config.`);
}

function parseArgs(argv) {
  const args = [...argv];
  const flags = new Set();
  let config = DEFAULT_CONFIG;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--config") {
      config = args[i + 1];
      args.splice(i, 2);
      i -= 1;
      continue;
    }

    if (args[i]?.startsWith("--")) {
      flags.add(args[i]);
      args.splice(i, 1);
      i -= 1;
    }
  }

  return { command: args[0] || "plan", config, flags };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function optionalEnv(name) {
  return process.env[name]?.trim() || null;
}

function passEntryPresent(name) {
  try {
    return Boolean(execFileSync("pass", ["show", name], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim());
  } catch {
    return false;
  }
}

function writePass(name, value) {
  execFileSync("pass", ["insert", "-m", "-f", name], { input: `${value}\n`, stdio: ["pipe", "ignore", "pipe"] });
}

function printPlan(config) {
  console.log(`Domain: ${config.domain}`);
  console.log(`Application: ${config.applicationName}`);
  console.log(`Allowed email domain: ${config.allowedEmailDomain}`);
  console.log(`Access domain: ${config.organization?.authDomain || "(current)"}`);
  console.log(`Identity provider: ${config.identityProvider.name} (${config.identityProvider.type})`);
  console.log(`Hosting: ${config.hosting?.provider || "external"}${config.hosting?.workerName ? ` (${config.hosting.workerName})` : ""}`);
  console.log(`DNS: ${config.dns?.managedBy || "explicit-records"}${config.dns?.records?.length ? ` (${config.dns.records.length} record(s))` : ""}`);
  console.log(`Service token: ${config.serviceToken?.name || "(none)"}`);
  console.log(`CLOUDFLARE_API_TOKEN: ${optionalEnv("CLOUDFLARE_API_TOKEN") ? "present" : "missing"}`);
  console.log(`CLOUDFLARE_ACCOUNT_ID: ${optionalEnv("CLOUDFLARE_ACCOUNT_ID") || "(discover)"}`);
  console.log(`CLOUDFLARE_ZONE_ID: ${optionalEnv("CLOUDFLARE_ZONE_ID") || "(discover)"}`);
  console.log("");
  console.log("Required API token capabilities:");
  console.log("- Read account and zone metadata");
  console.log("- Edit DNS records for scythe.work");
  console.log("- Edit Workers scripts and Workers custom domains/routes");
  console.log("- Edit Zero Trust Access applications and policies");
  console.log("- Edit Zero Trust organizations, identity providers, and groups");
  console.log("- Edit Zero Trust Access service tokens");
  console.log("");
  console.log("Important: Cloudflare Access can only protect scythe.work after scythe.work is an active Cloudflare zone.");
  if (config.hosting?.provider === "cloudflare-workers") {
    console.log("Deploy hosting with: npm run scythe:web:deploy");
  }
}

async function cf(method, resourcePath, body = null) {
  const response = await fetch(`${API_BASE}${resourcePath}`, {
    method,
    headers: {
      authorization: `Bearer ${requiredEnv("CLOUDFLARE_API_TOKEN")}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : null
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload.success === false) {
    const message = payload.errors?.map((error) => error.message).join("; ") || response.statusText;
    throw new Error(`${method} ${resourcePath} failed: ${message}`);
  }

  return payload;
}

async function cfPages(resourcePath) {
  const results = [];
  let page = 1;

  while (true) {
    const separator = resourcePath.includes("?") ? "&" : "?";
    const payload = await cf("GET", `${resourcePath}${separator}page=${page}&per_page=50`);
    results.push(...(payload.result || []));

    const info = payload.result_info;
    if (!info || page >= info.total_pages) return results;
    page += 1;
  }
}

async function resolveAccountId() {
  const fromEnv = optionalEnv("CLOUDFLARE_ACCOUNT_ID");
  if (fromEnv) return fromEnv;

  const accounts = await cfPages("/accounts");
  if (accounts.length === 1) return accounts[0].id;
  if (accounts.length === 0) throw new Error("The token cannot see any Cloudflare accounts.");

  const choices = accounts.map((account) => `${account.name || "(unnamed)"}: ${account.id}`).join("\n");
  throw new Error(`CLOUDFLARE_ACCOUNT_ID is required because the token can see multiple accounts:\n${choices}`);
}

async function resolveZone(config, accountId, flags) {
  const fromEnv = optionalEnv("CLOUDFLARE_ZONE_ID");
  if (fromEnv) {
    const payload = await cf("GET", `/zones/${fromEnv}`);
    return payload.result;
  }

  const zones = await cfPages(`/zones?name=${encodeURIComponent(config.domain)}`);
  const accountZones = zones.filter((zone) => zone.account?.id === accountId || !zone.account?.id);
  if (accountZones.length > 0) return accountZones[0];

  if (!flags.has("--create-zone")) {
    throw new Error(`No Cloudflare zone found for ${config.domain}. Add it to Cloudflare first, or rerun with --create-zone. The zone must become active before Access can protect the public hostname.`);
  }

  const payload = await cf("POST", "/zones", {
    name: config.domain,
    account: { id: accountId },
    type: "full",
    jump_start: false
  });

  return payload.result;
}

function fqdn(record, domain) {
  return record.name === "@" ? domain : `${record.name}.${domain}`;
}

async function ensureDns(config, zoneId) {
  const desired = config.dns?.records || [];
  const changed = [];

  for (const record of desired) {
    const name = fqdn(record, config.domain);
    const current = await cfPages(`/zones/${zoneId}/dns_records?type=${encodeURIComponent(record.type)}&name=${encodeURIComponent(name)}`);
    const matching = current.find((item) => item.content === record.content);
    const body = {
      type: record.type,
      name,
      content: record.content,
      ttl: 1,
      proxied: Boolean(config.dns.proxied)
    };

    if (matching) {
      if (matching.proxied !== body.proxied || matching.ttl !== body.ttl) {
        await cf("PATCH", `/zones/${zoneId}/dns_records/${matching.id}`, body);
        changed.push(`updated ${record.type} ${name} -> ${record.content}`);
      }
      continue;
    }

    await cf("POST", `/zones/${zoneId}/dns_records`, body);
    changed.push(`created ${record.type} ${name} -> ${record.content}`);
  }

  return changed;
}

async function ensureIdentityProvider(config, accountId) {
  const providers = await cfPages(`/accounts/${accountId}/access/identity_providers`);
  const existing = providers.find((provider) => provider.type === config.identityProvider.type && provider.name === config.identityProvider.name) || providers.find((provider) => provider.type === config.identityProvider.type);
  if (existing) return { provider: existing, changed: false };

  const body = {
    name: config.identityProvider.name,
    type: config.identityProvider.type,
    config: config.identityProvider.type === "cloudflare"
      ? { restrict_to_account_members: Boolean(config.identityProvider.restrictToAccountMembers) }
      : {}
  };

  const payload = await cf("POST", `/accounts/${accountId}/access/identity_providers`, body);
  return { provider: payload.result, changed: true };
}

function ensureStoredServiceTokenSecrets(config, token) {
  const refs = config.serviceToken?.secretRefs;
  if (!refs) return;

  if (token.client_id) writePass(refs.clientId, token.client_id);
  if (token.client_secret) writePass(refs.clientSecret, token.client_secret);

  const missing = [];
  if (!passEntryPresent(refs.clientId)) missing.push(refs.clientId);
  if (!passEntryPresent(refs.clientSecret)) missing.push(refs.clientSecret);
  if (missing.length > 0) {
    throw new Error(`Service token ${config.serviceToken.name} exists, but these pass entries are missing and Cloudflare will not reveal an existing client secret: ${missing.join(", ")}. Delete/recreate the service token or restore the pass entries.`);
  }
}

async function ensureServiceToken(config, accountId) {
  const desired = config.serviceToken;
  if (!desired) return { token: null, action: "disabled" };

  const tokens = await cfPages(`/accounts/${accountId}/access/service_tokens`);
  const existing = tokens.find((token) => token.name === desired.name);
  if (existing) {
    ensureStoredServiceTokenSecrets(config, existing);
    return { token: existing, action: "found" };
  }

  const payload = await cf("POST", `/accounts/${accountId}/access/service_tokens`, {
    name: desired.name,
    duration: desired.duration || "8760h"
  });
  ensureStoredServiceTokenSecrets(config, payload.result);
  return { token: payload.result, action: "created" };
}

function serviceTokenPolicy(serviceToken) {
  return {
    name: `Service Auth ${serviceToken.name}`,
    decision: "non_identity",
    precedence: 1,
    include: [{ service_token: { token_id: serviceToken.id } }]
  };
}

function accessApplicationBody(config, accountId, providerId, serviceToken) {
  const require = [];
  if (config.policy?.requireCloudflareAccountMember) {
    require.push({ cloudflare_account_member: { account_id: accountId } });
  }

  const policies = [];
  if (serviceToken) policies.push(serviceTokenPolicy(serviceToken));
  policies.push({
    name: `Allow ${config.allowedEmailDomain}`,
    decision: "allow",
    precedence: serviceToken ? 2 : 1,
    session_duration: config.sessionDuration,
    include: [{ email_domain: { domain: config.allowedEmailDomain } }],
    require
  });

  return {
    name: config.applicationName,
    domain: config.domain,
    type: "self_hosted",
    destinations: [{ type: "public", uri: config.domain }],
    allowed_idps: [providerId],
    auto_redirect_to_identity: true,
    app_launcher_visible: false,
    enable_binding_cookie: config.cookies?.binding ?? true,
    http_only_cookie_attribute: config.cookies?.httpOnly ?? true,
    same_site_cookie_attribute: config.cookies?.sameSite ?? "lax",
    session_duration: config.sessionDuration,
    policies
  };
}

function appMatchesDomain(app, domain) {
  if (app.domain === domain) return true;
  return Array.isArray(app.destinations) && app.destinations.some((destination) => destination.type === "public" && destination.uri === domain);
}

async function ensureAccessApplication(config, accountId, providerId, serviceToken) {
  const apps = await cfPages(`/accounts/${accountId}/access/apps`);
  const existing = apps.find((app) => appMatchesDomain(app, config.domain));
  const body = accessApplicationBody(config, accountId, providerId, serviceToken);

  if (existing) {
    const payload = await cf("PUT", `/accounts/${accountId}/access/apps/${existing.id}`, body);
    return { app: payload.result, changed: true, action: "updated" };
  }

  const payload = await cf("POST", `/accounts/${accountId}/access/apps`, body);
  return { app: payload.result, changed: true, action: "created" };
}

async function inspect(config) {
  const payload = await cf("GET", "/user/tokens/verify");
  console.log(`Token: ${payload.result.status}`);

  const accountId = await resolveAccountId();
  console.log(`Account: ${accountId}`);

  const organization = await getOrganization(accountId);
  console.log(`Access domain: ${organization.auth_domain}`);
  console.log(`Access org: ${organization.name}`);

  const zone = await resolveZone(config, accountId, new Set());
  console.log(`Zone: ${zone.id} (${zone.status})`);

  const apps = await cfPages(`/accounts/${accountId}/access/apps`);
  const app = apps.find((item) => appMatchesDomain(item, config.domain));
  console.log(`Access app: ${app ? `${app.name} (${app.id})` : "(missing)"}`);

  if (config.serviceToken) {
    const tokens = await cfPages(`/accounts/${accountId}/access/service_tokens`);
    const serviceToken = tokens.find((token) => token.name === config.serviceToken.name);
    console.log(`Service token: ${serviceToken ? `${serviceToken.name} (${serviceToken.id}) expires ${serviceToken.expires_at || "(unknown)"}` : "(missing)"}`);
  }

  if (!config.dns?.records?.length) {
    console.log(`DNS: managed by ${config.dns?.managedBy || "external"}`);
    return;
  }

  const records = await cfPages(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(config.domain)}`);
  for (const record of records) {
    console.log(`DNS: ${record.type} ${record.name} ${record.content} proxied=${record.proxied}`);
  }
}

async function getOrganization(accountId) {
  const payload = await cf("GET", `/accounts/${accountId}/access/organizations`);
  return payload.result;
}

function organizationBody(current, config) {
  const desired = config.organization || {};
  const loginDesign = desired.loginDesign || {};

  return {
    ...current,
    name: desired.name || current.name,
    auth_domain: desired.authDomain || current.auth_domain,
    login_design: {
      ...current.login_design,
      ...(loginDesign.backgroundColor ? { background_color: loginDesign.backgroundColor } : {}),
      ...(loginDesign.textColor ? { text_color: loginDesign.textColor } : {}),
      ...(loginDesign.headerText ? { header_text: loginDesign.headerText } : {}),
      ...(loginDesign.footerText ? { footer_text: loginDesign.footerText } : {}),
      ...(loginDesign.logoPath ? { logo_path: loginDesign.logoPath } : {})
    }
  };
}

function organizationNeedsUpdate(current, desired) {
  return current.name !== desired.name
    || current.auth_domain !== desired.auth_domain
    || JSON.stringify(current.login_design || {}) !== JSON.stringify(desired.login_design || {});
}

async function ensureOrganization(config, accountId) {
  const current = await getOrganization(accountId);
  const desired = organizationBody(current, config);
  if (!organizationNeedsUpdate(current, desired)) return { organization: current, changed: false };

  const payload = await cf("PUT", `/accounts/${accountId}/access/organizations`, desired);
  return { organization: payload.result, changed: true };
}

async function apply(config, flags) {
  const token = await cf("GET", "/user/tokens/verify");
  console.log(`Token: ${token.result.status}`);

  const accountId = await resolveAccountId();
  console.log(`Account: ${accountId}`);

  const { organization, changed: organizationChanged } = await ensureOrganization(config, accountId);
  console.log(`Access organization: ${organization.name} (${organization.auth_domain})${organizationChanged ? " updated" : ""}`);

  const zone = await resolveZone(config, accountId, flags);
  console.log(`Zone: ${zone.id} (${zone.status})`);
  if (zone.status !== "active") {
    const nameservers = (zone.name_servers || []).join(", ") || "(not returned)";
    throw new Error(`Cloudflare zone is ${zone.status}, not active. Set the registrar nameservers to Cloudflare first: ${nameservers}`);
  }

  if (!flags.has("--skip-dns")) {
    const dnsChanges = await ensureDns(config, zone.id);
    console.log(dnsChanges.length ? `DNS: ${dnsChanges.join("; ")}` : "DNS: already converged");
  }

  const { provider, changed: providerChanged } = await ensureIdentityProvider(config, accountId);
  console.log(`Identity provider: ${provider.name} (${provider.id})${providerChanged ? " created" : ""}`);

  const { token: serviceToken, action: serviceTokenAction } = await ensureServiceToken(config, accountId);
  if (serviceToken) {
    console.log(`Service token: ${serviceTokenAction} ${serviceToken.name} (${serviceToken.id}) expires ${serviceToken.expires_at || "(unknown)"}`);
  }

  const { app, action } = await ensureAccessApplication(config, accountId, provider.id, serviceToken);
  console.log(`Access app: ${action} ${app.name} (${app.id})`);
  console.log(`Access AUD: ${app.aud || "(not returned)"}`);
}

async function verify(config) {
  const response = await fetch(`https://${config.domain}`, { redirect: "manual" });
  console.log(`HTTPS status: ${response.status}`);
  console.log(`Server: ${response.headers.get("server") || "(missing)"}`);
  console.log(`Location: ${response.headers.get("location") || "(none)"}`);

  if (response.headers.get("server")?.toLowerCase() !== "cloudflare") {
    throw new Error("scythe.work is not currently being served by Cloudflare. DNS may not be proxied through Cloudflare yet.");
  }
}

async function main() {
  const { command, config: configPath, flags } = parseArgs(process.argv.slice(2));
  if (command === "help" || command === "--help") {
    usage();
    return;
  }

  const config = readJson(configPath);

  if (command === "plan") {
    printPlan(config);
    return;
  }

  if (command === "status") {
    await inspect(config);
    return;
  }

  if (command === "apply") {
    await apply(config, flags);
    return;
  }

  if (command === "verify") {
    await verify(config);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`scythe-cloudflare-access: ${error.message}`);
  process.exit(1);
});
