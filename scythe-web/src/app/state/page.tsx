import type { Metadata } from "next";
import { readDashboardData, type SchedulerStatus } from "@/lib/scythe";
import { ScytheHeader, SectionTitle, formatDate } from "@/components/scythe";

export const metadata: Metadata = {
  title: "State - Scythe",
};

export default function StatePage() {
  const data = readDashboardData();
  const scanRanAt = data.scheduler?.scanFinishedAt ?? data.scheduler?.finishedAt;
  const scanSignals = data.scheduler?.scanSignals ?? [];

  return (
    <main className="shell">
      <ScytheHeader />

      <section className="panel">
        <SectionTitle title="Tracker" meta={data.lastUpdated ? `updated ${formatDate(data.lastUpdated)}` : "updated unknown"} />
        <dl className="counts">
          <div>
            <dt>opportunities</dt>
            <dd>{data.opportunities.length}</dd>
          </div>
          <div>
            <dt>active</dt>
            <dd>{data.active.length}</dd>
          </div>
          <div>
            <dt>needs-inspection</dt>
            <dd>{data.needsInspection.length}</dd>
          </div>
          <div>
            <dt>saved-list</dt>
            <dd>{data.saved.length}</dd>
          </div>
          <div>
            <dt>pending-pipeline</dt>
            <dd>{data.pendingPipelineCount}</dd>
          </div>
        </dl>
      </section>

      <section className="panel lower">
        <SectionTitle title="Scan" meta={scanRanAt ? `ran ${formatDate(scanRanAt)}` : "not run"} />
        <dl className="counts">
          <div>
            <dt>state</dt>
            <dd>{data.scheduler?.state ?? "unknown"}</dd>
          </div>
          <div>
            <dt>new</dt>
            <dd>{data.scheduler?.summary.newOffersAdded ?? 0}</dd>
          </div>
          <div>
            <dt>jobs</dt>
            <dd>{data.scheduler?.summary.totalJobsFound ?? 0}</dd>
          </div>
          <div>
            <dt>duration</dt>
            <dd>{formatDuration(data.scheduler?.durationMs)}</dd>
          </div>
          <div>
            <dt>warnings</dt>
            <dd>{scanSignals.length}</dd>
          </div>
          <div>
            <dt>publish</dt>
            <dd>{formatPublish(data.scheduler?.publish)}</dd>
          </div>
          {data.scheduler?.error ? (
            <div>
              <dt>error</dt>
              <dd>{data.scheduler.error}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {scanSignals.length > 0 ? (
        <section className="panel lower">
          <SectionTitle title="Warnings" />
          <ul className="signal-list">
            {scanSignals.map((signal) => (
              <li key={signal.type}>
                <strong>{formatSignalType(signal.type)}</strong>
                <span>{signal.evidence[0] ?? signal.message}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CountSection title="Status" counts={data.statusCounts} />
      <CountSection title="Outcome" counts={data.outcomeCounts} />
      <CountSection title="Source" counts={data.sourceCounts} />
    </main>
  );
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs) return "unknown";
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function formatPublish(publish?: SchedulerStatus["publish"]): string {
  if (!publish) return "unknown";
  if (publish.deployed) return "deployed";
  if (publish.skipped) return "skipped";
  if (publish.required) return "required";
  return "skip";
}

function formatSignalType(type: string): string {
  return type.replaceAll("_", "-");
}

function CountSection({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <section className="panel lower">
      <SectionTitle title={title} />
      <dl className="counts">
        {Object.entries(counts).sort().map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
