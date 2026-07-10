const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function sanitizeText(value, max = 400) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

function normalizeVote(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value === "up" || value === "down") return value;
  throw new Error("vote must be up, down, or null");
}

function normalizeUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("url must be http(s)");
  return url.href;
}

async function listJudgements(env, url) {
  const savedOnly = url.searchParams.get("saved") === "1";
  const statement = savedOnly
    ? env.DB.prepare("SELECT url, vote, saved, reason, company, opportunity, location, source, score, created_at, updated_at FROM candidate_judgements WHERE saved = 1 ORDER BY updated_at DESC LIMIT 500")
    : env.DB.prepare("SELECT url, vote, saved, reason, company, opportunity, location, source, score, created_at, updated_at FROM candidate_judgements ORDER BY updated_at DESC LIMIT 1000");
  const result = await statement.all();
  return json({
    judgements: (result.results || []).map((row) => ({
      ...row,
      saved: Boolean(row.saved)
    }))
  });
}

async function updateJudgement(request, env) {
  const body = await request.json();
  const url = normalizeUrl(body.url);
  const hasVote = Object.prototype.hasOwnProperty.call(body, "vote");
  const hasSaved = Object.prototype.hasOwnProperty.call(body, "saved");
  if (!hasVote && !hasSaved) throw new Error("vote or saved is required");
  const hasReason = Object.prototype.hasOwnProperty.call(body, "reason");

  const existing = await env.DB.prepare("SELECT vote, saved, reason FROM candidate_judgements WHERE url = ?").bind(url).first();
  const vote = hasVote ? normalizeVote(body.vote) : (existing?.vote ?? null);
  const saved = hasSaved ? (body.saved ? 1 : 0) : (existing?.saved ? 1 : 0);
  const reason = hasReason ? sanitizeText(body.reason, 1200) : (existing?.reason ?? "");
  const eventReason = hasReason ? reason : null;
  const candidate = body.candidate || {};
  const company = sanitizeText(candidate.company, 160);
  const opportunity = sanitizeText(candidate.opportunity, 260);
  const location = sanitizeText(candidate.location, 160);
  const source = sanitizeText(candidate.source, 80);
  const score = Number.isFinite(Number(candidate.score)) ? Math.round(Number(candidate.score)) : 0;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO candidate_judgements (url, vote, saved, reason, company, opportunity, location, source, score, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      vote = excluded.vote,
      saved = excluded.saved,
      reason = excluded.reason,
      company = excluded.company,
      opportunity = excluded.opportunity,
      location = excluded.location,
      source = excluded.source,
      score = excluded.score,
      updated_at = excluded.updated_at
  `).bind(url, vote, saved, reason, company, opportunity, location, source, score, now, now).run();

  const action = hasVote && hasSaved ? "vote+save" : hasVote ? "vote" : "save";
  await env.DB.prepare(`
    INSERT INTO candidate_judgement_events (url, action, value, reason, company, opportunity, location, source, score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(url, action, JSON.stringify({ vote, saved: Boolean(saved), reason: eventReason }), eventReason, company, opportunity, location, source, score, now).run();

  return json({
    judgement: {
      url,
      vote,
      saved: Boolean(saved),
      reason,
      company,
      opportunity,
      location,
      source,
      score,
      updated_at: now
    }
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/judgements") return json({ error: "not found" }, 404);

  try {
    if (request.method === "GET") return await listJudgements(env, url);
    if (request.method === "POST") return await updateJudgement(request, env);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    return json({ error: error.message || "bad request" }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
