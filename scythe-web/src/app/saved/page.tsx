import type { Metadata } from "next";
import { readDashboardData } from "@/lib/scythe";
import { SavedCandidateList } from "@/components/candidate-queue";
import { ScytheHeader } from "@/components/scythe";

export const metadata: Metadata = {
  title: "Saved - Scythe",
};

export default function SavedPage() {
  const data = readDashboardData();

  return (
    <main className="shell">
      <ScytheHeader />
      <SavedCandidateList legacyItems={data.saved} />
    </main>
  );
}
