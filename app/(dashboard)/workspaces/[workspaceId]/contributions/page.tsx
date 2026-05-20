import { createClient } from "@/lib/supabase/server";
import { ContributionChart, type ComputedContribution } from "@/components/contributions/ContributionChart";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function ContributionsPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const [membersRes, tasksRes, filesRes, channelsRes] = await Promise.all([
    supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    supabase.from("tasks").select("id, assigned_to, created_by, status").eq("workspace_id", workspaceId),
    supabase.from("files").select("id, uploaded_by").eq("workspace_id", workspaceId),
    supabase.from("channels").select("id").eq("workspace_id", workspaceId),
  ]);

  const channelIds = (channelsRes.data ?? []).map((c) => c.id);
  const messagesRes = channelIds.length > 0
    ? await supabase.from("messages").select("id, user_id").in("channel_id", channelIds)
    : { data: [] };

  const members = (membersRes.data ?? []) as Array<{ user_id: string; profile: any }>;

  // Build stats per user
  const stats: Record<string, ComputedContribution> = {};
  members.forEach((m) => {
    const p = m.profile as any;
    stats[m.user_id] = {
      user_id: m.user_id,
      full_name: p?.full_name ?? p?.email ?? "Member",
      avatar_url: p?.avatar_url ?? null,
      tasks_completed: 0,
      tasks_created: 0,
      files_uploaded: 0,
      messages_sent: 0,
    };
  });

  for (const t of tasksRes.data ?? []) {
    if (t.status === "done" && t.assigned_to && stats[t.assigned_to]) {
      stats[t.assigned_to].tasks_completed++;
    }
    if (t.created_by && stats[t.created_by]) {
      stats[t.created_by].tasks_created++;
    }
  }

  for (const f of filesRes.data ?? []) {
    if ((f as any).uploaded_by && stats[(f as any).uploaded_by]) {
      stats[(f as any).uploaded_by].files_uploaded++;
    }
  }

  for (const m of messagesRes.data ?? []) {
    if ((m as any).user_id && stats[(m as any).user_id]) {
      stats[(m as any).user_id].messages_sent++;
    }
  }

  const contributions = Object.values(stats);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-6 fade-in stagger-1">
        <h1 className="text-2xl font-bold">Contribution Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">Tasks completed, files uploaded, and messages sent per member</p>
      </div>
      <div className="fade-in stagger-2">
        <ContributionChart contributions={contributions} />
      </div>
    </div>
  );
}
