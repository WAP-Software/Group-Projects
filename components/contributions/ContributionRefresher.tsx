"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ContributionRefresher({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const sub = supabase
      .channel(`contributions-refresh:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `workspace_id=eq.${workspaceId}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "files", filter: `workspace_id=eq.${workspaceId}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId, router, supabase]);

  return null;
}
