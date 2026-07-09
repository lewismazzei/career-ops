import Link from "next/link";
import type { OpportunityItem } from "@/lib/scythe";

type MinimalOpportunity = {
  n: string | number;
  company: string;
  opportunity: string;
};

export function ScytheHeader({ meta }: { meta?: string } = {}) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <p className="kicker">Scythe</p>
        {meta ? <span className="header-meta">{meta}</span> : null}
      </div>
      <nav className="nav" aria-label="Scythe navigation">
        <Link href="/">Queue</Link>
        <Link href="/saved">Saved</Link>
        <Link href="/state">State</Link>
      </nav>
    </header>
  );
}

export function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}

export function OpportunityTable({ items, empty }: { items: OpportunityItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState text={empty} />;

  return (
    <div className="table-wrap">
      <table className="obs-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Item</th>
            <th>Class</th>
            <th>Next</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.n}>
              <td>
                <strong>{item.status}</strong>
                <small>{item.outcome}</small>
              </td>
              <td>
                <strong>{item.company}</strong>
                <small>{item.opportunity}</small>
              </td>
              <td>
                <strong>{item.category}</strong>
                <small>{item.source} / {item.remoteClass}</small>
              </td>
              <td>{item.nextAction || "none"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OpportunityList({ items, empty }: { items: MinimalOpportunity[]; empty: string }) {
  if (items.length === 0) return <EmptyState text={empty} />;

  return (
    <ul className="opportunity-list">
      {items.map((item) => (
        <li key={item.n}>
          <span className="company">{item.company}</span>
          <span className="role">{item.opportunity}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
