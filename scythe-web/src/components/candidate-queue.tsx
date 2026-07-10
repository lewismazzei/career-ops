"use client";

import { useEffect, useMemo, useState } from "react";
import type { CandidateItem, SavedItem } from "@/lib/scythe";

type Vote = "up" | "down";
type QueueActionIcon = "upvote" | "downvote" | "bookmark";

type Judgement = {
  url: string;
  vote: Vote | null;
  saved: boolean;
  reason?: string | null;
  company: string;
  opportunity: string;
  location: string;
  source: string;
  score: number;
  updated_at?: string;
};

const STOP_WORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "from",
  "remote",
  "senior",
  "junior",
  "lead",
  "manager",
  "full",
  "time"
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function judgementMap(judgements: Judgement[]): Record<string, Judgement> {
  return Object.fromEntries(judgements.map((judgement) => [judgement.url, judgement]));
}

function learnedWeights(judgements: Judgement[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const judgement of judgements) {
    const delta = (judgement.vote === "up" ? 4 : judgement.vote === "down" ? -4 : 0) + (judgement.saved ? 3 : 0);
    if (!delta) continue;
    for (const token of new Set(tokens(`${judgement.company} ${judgement.opportunity} ${judgement.location} ${judgement.source} ${judgement.reason ?? ""}`))) {
      weights.set(token, (weights.get(token) ?? 0) + delta);
    }
  }
  return weights;
}

function adjustedScore(candidate: CandidateItem, judgement: Judgement | undefined, weights: Map<string, number>): number {
  const learned = tokens(`${candidate.company} ${candidate.opportunity} ${candidate.location} ${candidate.source} ${judgement?.reason ?? ""}`)
    .reduce((sum, token) => sum + (weights.get(token) ?? 0), 0);
  const exact = judgement?.vote === "up" ? 40 : judgement?.vote === "down" ? -90 : 0;
  const saved = judgement?.saved ? 30 : 0;
  return candidate.score + exact + saved + clamp(learned, -20, 20);
}

function QueueActionSymbol({ icon }: { icon: QueueActionIcon }) {
  if (icon === "upvote") {
    return (
      <svg className="queue-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4 5 12h4v8h6v-8h4L12 4Z" />
      </svg>
    );
  }

  if (icon === "downvote") {
    return (
      <svg className="queue-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20 5 12h4V4h6v8h4l-7 8Z" />
      </svg>
    );
  }

  return (
    <svg className="queue-action-icon bookmark-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4.5C7 3.7 7.7 3 8.5 3h7c.8 0 1.5.7 1.5 1.5V20l-5-3.2L7 20V4.5Z" />
    </svg>
  );
}

function QueueActionButton({
  active,
  disabled,
  icon,
  label,
  onClick
}: {
  active: boolean;
  disabled: boolean;
  icon: QueueActionIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <QueueActionSymbol icon={icon} />
    </button>
  );
}

async function fetchJudgements(savedOnly = false): Promise<Judgement[]> {
  const response = await fetch(`/api/judgements${savedOnly ? "?saved=1" : ""}`, {
    credentials: "same-origin",
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`judgements ${response.status}`);
  const payload = await response.json() as { judgements?: Judgement[] };
  return payload.judgements ?? [];
}

async function postJudgement(candidate: CandidateItem, patch: { vote?: Vote | null; saved?: boolean }, reason?: string): Promise<Judgement> {
  const response = await fetch("/api/judgements", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: candidate.url,
      ...patch,
      ...(reason === undefined ? {} : { reason }),
      candidate: {
        company: candidate.company,
        opportunity: candidate.opportunity,
        location: candidate.location,
        source: candidate.source,
        score: candidate.score
      }
    })
  });
  if (!response.ok) throw new Error(`save ${response.status}`);
  const payload = await response.json() as { judgement: Judgement };
  return payload.judgement;
}

export function CandidateQueue({ items }: { items: CandidateItem[] }) {
  const [judgements, setJudgements] = useState<Judgement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ candidate: CandidateItem; patch: { vote?: Vote | null; saved?: boolean }; action: "up" | "down" | "save" } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    fetchJudgements()
      .then((next) => {
        setJudgements(next);
        setError(null);
      })
      .catch(() => setError("judgement API unavailable"));
  }, []);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPrompt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt]);

  const byUrl = useMemo(() => judgementMap(judgements), [judgements]);
  const weights = useMemo(() => learnedWeights(judgements), [judgements]);
  const ranked = useMemo(() => {
    return [...items]
      .map((item) => ({ item, judgement: byUrl[item.url], rank: adjustedScore(item, byUrl[item.url], weights) }))
      .sort((a, b) => b.rank - a.rank || a.item.company.localeCompare(b.item.company));
  }, [items, byUrl, weights]);

  async function update(candidate: CandidateItem, patch: { vote?: Vote | null; saved?: boolean }, reasonText?: string): Promise<boolean> {
    setBusy(candidate.url);
    try {
      const next = await postJudgement(candidate, patch, reasonText);
      setJudgements((current) => [next, ...current.filter((item) => item.url !== next.url)]);
      setError(null);
      return true;
    } catch {
      setError("save failed");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function submitPrompt(includeReason: boolean) {
    if (!prompt) return;
    const ok = await update(prompt.candidate, prompt.patch, includeReason ? reason.trim() : undefined);
    if (!ok) return;
    setPrompt(null);
    setReason("");
  }

  function openPrompt(candidate: CandidateItem, patch: { vote?: Vote | null; saved?: boolean }, action: "up" | "down" | "save") {
    setReason("");
    setPrompt({ candidate, patch, action });
  }

  if (items.length === 0) return <div className="empty">No pending candidates.</div>;

  return (
    <section className="queue">
      <div className="queue-meta">
        <span>{items.length} pending</span>
        {error ? <span>{error}</span> : null}
      </div>
      <ul className="candidate-list">
        {ranked.map(({ item, judgement, rank }) => (
          <li key={item.url} className={judgement?.vote === "down" ? "candidate muted-candidate" : "candidate"}>
            <div className="candidate-main">
              <a href={item.url} target="_blank" rel="noreferrer">
                <span className="company">{item.company}</span>
                <span className="role">{item.opportunity}</span>
              </a>
              <span className="candidate-meta">
                {item.source}{item.location ? ` / ${item.location}` : ""}
              </span>
              {item.signals.length > 0 ? (
                <span className="candidate-signals">{item.signals.join(" / ")}</span>
              ) : null}
            </div>
            <div className="candidate-side">
              <span className="candidate-score" aria-label={`Score ${Math.round(rank)}`}>{Math.round(rank)}</span>
              <div className="candidate-actions" aria-label={`Judge ${item.company} ${item.opportunity}`}>
                <QueueActionButton
                  active={judgement?.vote === "up"}
                  disabled={busy === item.url}
                  icon="upvote"
                  label={judgement?.vote === "up" ? `Remove upvote for ${item.company} ${item.opportunity}` : `Upvote ${item.company} ${item.opportunity}`}
                  onClick={() => judgement?.vote === "up" ? void update(item, { vote: null }) : openPrompt(item, { vote: "up" }, "up")}
                />
                <QueueActionButton
                  active={judgement?.vote === "down"}
                  disabled={busy === item.url}
                  icon="downvote"
                  label={judgement?.vote === "down" ? `Remove downvote for ${item.company} ${item.opportunity}` : `Downvote ${item.company} ${item.opportunity}`}
                  onClick={() => judgement?.vote === "down" ? void update(item, { vote: null }) : openPrompt(item, { vote: "down" }, "down")}
                />
                <QueueActionButton
                  active={judgement?.saved ?? false}
                  disabled={busy === item.url}
                  icon="bookmark"
                  label={judgement?.saved ? `Unsave ${item.company} ${item.opportunity}` : `Save ${item.company} ${item.opportunity}`}
                  onClick={() => judgement?.saved ? void update(item, { saved: false }) : openPrompt(item, { saved: true }, "save")}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {prompt ? (
        <div className="modal-backdrop">
          <form className="reason-modal" role="dialog" aria-modal="true" aria-labelledby="reason-title" onSubmit={(event) => { event.preventDefault(); void submitPrompt(true); }}>
            <div className="reason-head">
              <h2 id="reason-title">Why {prompt.action}?</h2>
              <button type="button" onClick={() => setPrompt(null)} aria-label="Close">X</button>
            </div>
            <div className="reason-context">
              <span>{prompt.candidate.company}</span>
              <strong>{prompt.candidate.opportunity}</strong>
            </div>
            <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" rows={4} />
            <div className="reason-actions">
              <button type="submit" disabled={busy === prompt.candidate.url || !reason.trim()}>SAVE</button>
              <button type="button" disabled={busy === prompt.candidate.url} onClick={() => void submitPrompt(false)}>SKIP</button>
              <button type="button" disabled={busy === prompt.candidate.url} onClick={() => setPrompt(null)}>CANCEL</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export function SavedCandidateList({ legacyItems }: { legacyItems: SavedItem[] }) {
  const [saved, setSaved] = useState<Judgement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJudgements(true)
      .then((next) => {
        setSaved(next);
        setError(null);
      })
      .catch(() => setError("saved API unavailable"));
  }, []);

  return (
    <section className="saved-stack">
      {error ? <div className="empty">{error}</div> : null}
      {saved.length > 0 ? (
        <ul className="candidate-list">
          {saved.map((item) => (
            <li key={item.url} className="candidate">
              <div className="candidate-main">
                <a href={item.url} target="_blank" rel="noreferrer">
                  <span className="company">{item.company}</span>
                  <span className="role">{item.opportunity}</span>
                </a>
                <span className="candidate-meta">{item.source}{item.location ? ` / ${item.location}` : ""}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {legacyItems.length > 0 ? (
        <ul className="opportunity-list">
          {legacyItems.map((item) => (
            <li key={item.n}>
              <span className="company">{item.company}</span>
              <span className="role">{item.opportunity}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {saved.length === 0 && legacyItems.length === 0 && !error ? <div className="empty">No saved items yet.</div> : null}
    </section>
  );
}
