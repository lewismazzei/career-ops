import fs from "node:fs";
import path from "node:path";

type TableRow = string[];

export type OpportunityItem = {
  n: string;
  date: string;
  source: string;
  category: string;
  company: string;
  opportunity: string;
  remoteClass: string;
  agentLeverage: string;
  proofMatch: string;
  nextAction: string;
  status: string;
  outcome: string;
  notes: string;
  links: string[];
};

export type SavedItem = {
  n: string;
  dateSaved: string;
  source: string;
  company: string;
  opportunity: string;
  whySaved: string;
  gapToClose: string;
  revisitTrigger: string;
  notes: string;
  links: string[];
};

export type CandidateItem = {
  n: number;
  url: string;
  source: string;
  company: string;
  opportunity: string;
  location: string;
  note: string;
  score: number;
  signals: string[];
  excluded: boolean;
  exclusionReason?: string;
  exclusionLabel?: string;
};

export type DashboardData = {
  opportunities: OpportunityItem[];
  candidates: CandidateItem[];
  excludedCandidates: CandidateItem[];
  allCandidates: CandidateItem[];
  active: OpportunityItem[];
  needsInspection: OpportunityItem[];
  saved: SavedItem[];
  scheduler: SchedulerStatus | null;
  pendingPipelineCount: number;
  statusCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  lastUpdated: string | null;
};

export type SchedulerStatus = {
  state: string;
  ok: boolean;
  dryRun: boolean;
  startedAt: string;
  scanFinishedAt?: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  logPath: string;
  pendingPipelineCount: number;
  summary: {
    companiesScanned?: number | null;
    jobBoardsScanned?: number | null;
    totalJobsFound?: number | null;
    duplicatesSkipped?: number | null;
    excludedCandidatesVisible?: number | null;
    excludedCandidatesChanged?: number | null;
    newOffersAdded?: number | null;
    expiredDropped?: number | null;
    noApplyDropped?: number | null;
    invalidDropped?: number | null;
  };
  scanSignals?: Array<{
    type: string;
    severity: string;
    message: string;
    evidence: string[];
  }>;
  warnings?: string[];
  publish?: {
    required: boolean;
    reason: string;
    dataChanged: boolean;
    signalsNeedSurface: boolean;
    skipped: boolean;
    deployed: boolean;
    verifyAuth: boolean;
    verifyBrowser: boolean;
  };
  steps: Array<{
    name: string;
    ok: boolean;
    code: number | null;
    startedAt: string;
    finishedAt: string;
  }>;
  error?: string;
};

function scytheRoot(): string {
  return process.env.SCYTHE_ROOT?.trim() || path.resolve(process.cwd(), "..");
}

function envData(rel: string): string | null {
  if (rel === "data/opportunities.md") return process.env.SCYTHE_OPPORTUNITIES_MD ?? null;
  if (rel === "data/saved.md") return process.env.SCYTHE_SAVED_MD ?? null;
  if (rel === "data/pipeline.md") return process.env.SCYTHE_PIPELINE_MD ?? null;
  if (rel === "data/scythe-excluded-candidates.json") return process.env.SCYTHE_EXCLUDED_CANDIDATES_JSON ?? null;
  return null;
}

function read(rel: string): string | null {
  const fromEnv = envData(rel);
  if (fromEnv !== null) return fromEnv;

  try {
    return fs.readFileSync(path.join(scytheRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

function modified(rel: string): string | null {
  if (rel === "data/opportunities.md" && process.env.SCYTHE_DATA_LAST_UPDATED) return process.env.SCYTHE_DATA_LAST_UPDATED;

  try {
    return fs.statSync(path.join(scytheRoot(), rel)).mtime.toISOString();
  } catch {
    return null;
  }
}

function markdownRows(md: string | null): TableRow[] {
  if (!md) return [];
  return md
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length > 0 && cells[0] !== "#" && !/^:?-{2,}:?$/.test(cells[0]));
}

function linksFrom(text: string): string[] {
  return [...new Set(text.match(/https?:\/\/[^\s)]+/g)?.map((url) => url.replace(/[.,;]+$/, "")) ?? [])];
}

function stripLinks(text: string): string {
  return text.replace(/https?:\/\/[^\s)]+/g, "").replace(/\s{2,}/g, " ").replace(/[;,\s]+$/, "").trim();
}

function cleanPipelineText(text: string): string {
  return text
    .replace(/\\([\[\]])/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function scoreCandidate(candidate: Pick<CandidateItem, "company" | "opportunity" | "location" | "source" | "note">): { score: number; signals: string[] } {
  const text = `${candidate.company} ${candidate.opportunity} ${candidate.location} ${candidate.source} ${candidate.note}`.toLowerCase();
  let score = 50;
  const signals: string[] = [];

  const add = (points: number, signal: string) => {
    score += points;
    if (!signals.includes(signal)) signals.push(signal);
  };

  if (/\b(contract|contractor|freelance|consultant|consulting|fractional|interim)\b/.test(text)) add(22, "contract");
  if (/\b(ai|agentic|agent|automation|workflow|internal tools|systems)\b/.test(text)) add(18, "agent/automation");
  if (/\b(software|engineer|developer|full-stack|architect|technical)\b/.test(text)) add(14, "software");
  if (/\b(data|excel|research|document|writer|copywriter|marketing)\b/.test(text)) add(10, "agent-leveraged");
  if (/\b(worldwide|anywhere|global|remote)\b/.test(text)) add(10, "remote");
  if (/\b(europe|emea|uk|united kingdom)\b/.test(text)) add(6, "timezone");
  if (/\$|£|€|\/hr|hour|fixed|budget/.test(text)) add(8, "pay-signal");

  if (/\b(customer support|support consultant|sales|manager,|director|lead\b|head of)\b/.test(text)) score -= 12;
  if (/\b(polish|dutch|german|finnish|danish|swedish|ukraine|greece)\b/.test(text)) score -= 10;
  if (/\b(usa only|us only|hybrid|onsite|on-site)\b/.test(text)) score -= 18;

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: signals.slice(0, 3)
  };
}

function pendingPipelineCandidates(): CandidateItem[] {
  const text = read("data/pipeline.md");
  if (!text) return [];
  const pendingStart = text.indexOf("## Pending");
  if (pendingStart === -1) return [];
  const nextSection = text.indexOf("\n## ", pendingStart + "## Pending".length);
  const pending = nextSection === -1 ? text.slice(pendingStart) : text.slice(pendingStart, nextSection);

  return pending
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- [ ] "))
    .map((line, index) => {
      const raw = line.replace(/^- \[ \]\s+/, "");
      const [url = "", company = "", opportunity = "", location = "", ...rest] = raw.split("|").map((part) => cleanPipelineText(part));
      const note = rest.join(" / ").replace(/^note:\s*/i, "");
      const base = {
        n: index + 1,
        url,
        source: sourceFromUrl(url),
        company,
        opportunity,
        location,
        note,
        excluded: false
      };
      const { score, signals } = scoreCandidate(base);
      return { ...base, score, signals };
    })
    .filter((candidate) => candidate.url && candidate.company && candidate.opportunity)
    .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
}

type ExcludedCandidateArtifact = {
  schemaVersion?: number;
  candidates?: Array<{
    url?: unknown;
    source?: unknown;
    company?: unknown;
    title?: unknown;
    opportunity?: unknown;
    location?: unknown;
    reason?: unknown;
    reasonLabel?: unknown;
    detail?: unknown;
    compensation?: unknown;
    note?: unknown;
  }>;
};

function cleanArtifactText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function readExcludedCandidates(bestUrls: Set<string>): CandidateItem[] {
  const artifact = readJson<ExcludedCandidateArtifact>("data/scythe-excluded-candidates.json");
  const rows = Array.isArray(artifact?.candidates) ? artifact.candidates : [];
  const seen = new Set(bestUrls);
  const candidates: CandidateItem[] = [];

  for (const row of rows) {
    const url = cleanArtifactText(row.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const source = cleanArtifactText(row.source) || sourceFromUrl(url);
    const company = cleanArtifactText(row.company) || source;
    const opportunity = cleanArtifactText(row.title) || cleanArtifactText(row.opportunity) || "Untitled";
    const location = cleanArtifactText(row.location);
    const reason = cleanArtifactText(row.reason) || "excluded";
    const label = cleanArtifactText(row.reasonLabel) || reason.replaceAll("_", "-");
    const details = [
      cleanArtifactText(row.note),
      cleanArtifactText(row.compensation),
      cleanArtifactText(row.detail),
    ].filter(Boolean);
    const base = {
      n: bestUrls.size + candidates.length + 1,
      url,
      source,
      company,
      opportunity,
      location,
      note: details.join(" / "),
      excluded: true,
      exclusionReason: reason,
      exclusionLabel: label,
    };
    const { score, signals } = scoreCandidate(base);
    candidates.push({ ...base, score, signals });
  }

  return candidates.sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
}

function readJson<T>(rel: string): T | null {
  const text = read(rel);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function pendingPipelineCount(): number {
  const text = read("data/pipeline.md");
  if (!text) return 0;
  const pendingStart = text.indexOf("## Pending");
  if (pendingStart === -1) return 0;
  const nextSection = text.indexOf("\n## ", pendingStart + "## Pending".length);
  const pending = nextSection === -1 ? text.slice(pendingStart) : text.slice(pendingStart, nextSection);
  return pending.split(/\r?\n/).filter((line) => /^- \[ \] https?:\/\//.test(line.trim())).length;
}

function countsBy<T>(items: T[], value: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = value(item) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function isActive(item: OpportunityItem): boolean {
  return item.status === "pursue";
}

function needsInspection(item: OpportunityItem): boolean {
  return isActive(item) && !/user reviewed|prepare|draft|resolve|position/i.test(`${item.nextAction} ${item.notes}`);
}

export function readOpportunityItems(): OpportunityItem[] {
  return markdownRows(read("data/opportunities.md"))
    .filter((cells) => cells.length >= 13)
    .map((cells) => {
      const [n, date, source, category, company, opportunity, remoteClass, agentLeverage, proofMatch, nextAction, status, outcome, ...notes] = cells;
      const rawNotes = notes.join(" | ");
      return {
        n,
        date,
        source,
        category,
        company,
        opportunity,
        remoteClass,
        agentLeverage,
        proofMatch,
        nextAction,
        status,
        outcome,
        notes: stripLinks(rawNotes),
        links: linksFrom(rawNotes),
      };
    });
}

export function readSavedItems(): SavedItem[] {
  return markdownRows(read("data/saved.md"))
    .filter((cells) => cells.length >= 9)
    .map((cells) => {
      const [n, dateSaved, source, company, opportunity, whySaved, gapToClose, revisitTrigger, ...notes] = cells;
      const rawNotes = notes.join(" | ");
      return {
        n,
        dateSaved,
        source,
        company,
        opportunity,
        whySaved,
        gapToClose,
        revisitTrigger,
        notes: stripLinks(rawNotes),
        links: linksFrom(rawNotes),
      };
    });
}

export function readDashboardData(): DashboardData {
  const opportunities = readOpportunityItems();
  const scheduler = readJson<SchedulerStatus>("data/scythe-scheduler-status.json");
  const candidates = pendingPipelineCandidates();
  const excludedCandidates = readExcludedCandidates(new Set(candidates.map((candidate) => candidate.url)));
  return {
    opportunities,
    candidates,
    excludedCandidates,
    allCandidates: [...candidates, ...excludedCandidates],
    active: opportunities.filter(isActive),
    needsInspection: opportunities.filter(needsInspection),
    saved: readSavedItems(),
    scheduler,
    pendingPipelineCount: scheduler?.pendingPipelineCount ?? pendingPipelineCount(),
    statusCounts: countsBy(opportunities, (item) => item.status),
    outcomeCounts: countsBy(opportunities, (item) => item.outcome),
    sourceCounts: countsBy(opportunities, (item) => item.source),
    lastUpdated: modified("data/opportunities.md"),
  };
}
