import { createClient } from "@/lib/supabase/server";
import { ContributionChart } from "@/components/contributions/ContributionChart";
import type { Contribution } from "@/types/database";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function ContributionsPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("contributions")
    .select("*")
    .eq("workspace_id", workspaceId);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-6 fade-in stagger-1">
        <h1 className="text-2xl font-bold">Contribution Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">Track team activity and contributions</p>
      </div>
      <div className="fade-in stagger-2">
        <ContributionChart contributions={(data as Contribution[]) ?? []} />
      </div>
    </div>
  );
}
