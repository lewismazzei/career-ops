# Cloudflare Access for Scythe

Goal: make Cloudflare the permanent owner of `https://scythe.work`: hosting, custom domain routing, DNS, and Access.

## Current State

`scythe.work` is served from Cloudflare Workers static assets and protected by Cloudflare Access. Vercel is no longer the intended production path for Scythe.

## Agent-Managed Path

Desired Cloudflare state is stored in:

- `access.profile.json`: non-secret service/access profile for Scythe
- `config/cloudflare-access.scythe.json`: desired DNS and Access app config
- `scythe-web/wrangler.jsonc`: Cloudflare Worker static asset hosting and `scythe.work` custom domain
- `scythe-cloudflare-access.mjs`: converges Cloudflare Access state through the API
- `scythe-verify-auth.mjs`: verifies the protected production URL using the agent service token
- `scythe-web/migrations/`: D1 schema for queue judgements

The desired Access organization domain is:

```text
scythe-work.cloudflareaccess.com
```

The login page design is intentionally minimal and mirrors the Scythe UI palette: warm off-white background, dark text, uppercase `SCYTHE` header, and terse footer copy.

Commands:

```sh
npm run scythe:web:build
npm run scythe:web:deploy
npm run scythe:cloudflare:plan
npm run scythe:cloudflare:status
npm run scythe:cloudflare:apply
npm run scythe:cloudflare:verify
npm run scythe:verify:auth
npm run scythe:verify:browser
npm run scythe:web:d1:migrate
```

If the zone does not exist in Cloudflare yet:

```sh
npm run scythe:cloudflare:apply -- --create-zone
```

If the token can see multiple Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID`. If zone discovery fails, set `CLOUDFLARE_ZONE_ID`.

## Bootstrap Credential

The agent needs one scoped Cloudflare API token exposed as `CLOUDFLARE_API_TOKEN`. Do not commit it. Cloudflare says API token secrets are shown once, so this is the one manual copy step.

The project secrets broker is `pass`, initialized with the local `scythe-agent@mazzei.dev` machine key. Store the token at:

```text
cloudflare/scythe/access-admin-token
```

Load brokered env vars into a shell with:

```sh
eval "$(npm run --silent scythe:env)"
```

Dashboard:

- API tokens: https://dash.cloudflare.com/profile/api-tokens
- Zero Trust: https://one.dash.cloudflare.com/
- Workers & Pages: https://dash.cloudflare.com/?to=/:account/workers-and-pages

Required capability:

- read account, user, membership, and zone metadata
- edit DNS records for `scythe.work`
- edit Workers scripts
- edit Workers routes/custom domains for `scythe.work`
- edit D1 databases
- edit Zero Trust Access applications and policies
- edit Zero Trust Access service tokens
- edit Zero Trust organizations, identity providers, and groups

This is the capability boundary from the earlier access-system thread: Codex gets a scoped project capability, not raw account login, mailbox access, or OTP access.

## Agent Access

The agent does not use the browser login flow. It uses a Cloudflare Access service token named:

```text
scythe-agent-verify
```

The client ID and client secret are stored in `pass`:

```text
cloudflare/scythe/access-service-client-id
cloudflare/scythe/access-service-client-secret
```

`npm run scythe:env` exports them as:

```text
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
```

The Access app has two policies:

- Service Auth for `scythe-agent-verify`
- Allow for the human `mazzei.dev` email domain

Run the authenticated production check with:

```sh
eval "$(npm run --silent scythe:env)" && npm run scythe:verify:auth
```

Run the authenticated browser check with:

```sh
eval "$(npm run --silent scythe:env)" && npm run scythe:verify:browser
```

The browser check uses the Cloudflare Access service-token headers in a mobile viewport by default and writes a screenshot to:

```text
reports/scythe-auth-browser.png
```

If the VPS has not had Playwright browser system dependencies installed, the browser check will fail before it can launch Chromium. On Ubuntu 24.04, the observed missing libraries are provided by:

```sh
sudo apt-get update && sudo apt-get install -y libnspr4 libnss3 libasound2t64
```

The broader Playwright-managed alternative is `sudo npx playwright install-deps chromium`.

Cloudflare only shows the service-token client secret at creation time. If the `pass` entry is lost, create a new service token or delete the old one and rerun `npm run scythe:cloudflare:apply`.

## Judgement State

The queue judgement UI stores state in the Cloudflare D1 database:

```text
scythe
```

The Worker exposes:

```text
GET  /api/judgements
GET  /api/judgements?saved=1
POST /api/judgements
```

`POST /api/judgements` accepts a candidate URL plus `vote` (`up`, `down`, or `null`) and/or `saved` (`true` or `false`). It upserts the current judgement and appends an event row for later learning.

## Policy Shape

The current desired human policy requires:

- email domain: `mazzei.dev`

The login method is One-time PIN. New Cloudflare Zero Trust organizations default to Cloudflare account login, but that sends the user through `dash.cloudflare.com` and was a bad fit for mobile. OTP keeps login scoped to email ownership for `@mazzei.dev`.

## Remaining Manual Boundary

If Cloudflare does not already host the `scythe.work` zone, the script can create the zone but it cannot make the zone active unless the registrar nameservers point to Cloudflare.

For the current Porkbun-held domain, either:

- change nameservers once in Porkbun, or
- provide a scoped Porkbun API credential later and automate that registrar step too.

After this is complete, Vercel should no longer be in Scythe's production path.

Official docs:

- Workers static assets: https://developers.cloudflare.com/workers/static-assets/
- Workers custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Access self-hosted public app: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
- Access applications API: https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/
- Cloudflare identity provider: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/cloudflare/
