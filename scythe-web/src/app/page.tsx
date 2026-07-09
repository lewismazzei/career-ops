import type { Metadata } from "next";
import { readDashboardData } from "@/lib/scythe";
import { CandidateQueue } from "@/components/candidate-queue";
import { ScytheHeader, formatDate } from "@/components/scythe";

export const metadata: Metadata = {
  title: "Scythe",
};

export default function Home() {
  const data = readDashboardData();
  const queueUpdatedAt = data.scheduler?.finishedAt ?? data.lastUpdated;

  return (
    <main className="shell">
      <ScytheHeader meta={queueUpdatedAt ? `updated ${formatDate(queueUpdatedAt)}` : undefined} />
      <CandidateQueue items={data.candidates} />
    </main>
  );
}
