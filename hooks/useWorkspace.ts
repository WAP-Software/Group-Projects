"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Workspace, WorkspaceMember } from "@/types/database";

export function useWorkspace(workspaceId: string) {
  const supabase = createClient();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [myRole, setMyRole] = useState<"owner" | "editor" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const [wsResult, membersResult] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", workspaceId).single(),
        supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId),
      ]);

      if (wsResult.data) setWorkspace(wsResult.data);
      if (membersResult.data) {
        setMembers(membersResult.data);
        const me = membersResult.data.find((m) => m.user_id === user?.id);
        setMyRole(me?.role ?? null);
      }
      setLoading(false);
    }

    load();
  }, [workspaceId, supabase]);

  return { workspace, members, myRole, loading };
}
