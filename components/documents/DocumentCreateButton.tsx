"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workspaceId: string;
}

export function DocumentCreateButton({ workspaceId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("documents")
      .insert({ workspace_id: workspaceId, title: "Untitled Document", created_by: user.id })
      .select()
      .single();

    if (error || !data) {
      toast.error("Failed to create document");
      setLoading(false);
      return;
    }
    router.push(`/workspaces/${workspaceId}/documents/${data.id}`);
  }

  return (
    <Button onClick={create} disabled={loading} className="gap-2 pressable">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      New Document
    </Button>
  );
}
