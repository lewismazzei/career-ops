import type { Metadata } from "next";
import { readDashboardData } from "@/lib/scythe";
import { OpportunityList, ScytheHeader } from "@/components/scythe";

export const metadata: Metadata = {
  title: "Opportunities - Scythe",
};

export default function OpportunitiesPage() {
  const data = readDashboardData();

  return (
    <main className="shell">
      <ScytheHeader />
      <OpportunityList items={data.opportunities} empty="No opportunities collected yet." />
    </main>
  );
}
