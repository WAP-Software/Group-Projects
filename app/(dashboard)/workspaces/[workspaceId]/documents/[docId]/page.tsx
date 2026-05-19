"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Props {
  params: Promise<{ workspaceId: string; docId: string }>;
}

export default function DocumentEditorPage({ params }: Props) {
  const { workspaceId, docId } = use(params);
  const supabase = createClient();
  const [title, setTitle] = useState("Loading…");
  const [status, setStatus] = useState<"draft" | "in_review" | "approved">("draft");
  const [titleTimeout, setTitleTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.from("documents").select("title, status").eq("id", docId).single().then(({ data }) => {
      if (data) {
        setTitle(data.title);
        setStatus(data.status as any);
      }
    });
  }, [docId, supabase]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (titleTimeout) clearTimeout(titleTimeout);
    const t = setTimeout(async () => {
      await supabase.from("documents").update({ title: value }).eq("id", docId);
    }, 800);
    setTitleTimeout(t);
  }

  async function handleStatusChange(value: "draft" | "in_review" | "approved") {
    setStatus(value);
    const { error } = await supabase.from("documents").update({ status: value }).eq("id", docId);
    if (error) toast.error("Failed to update status");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Doc header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background">
        <Link
          href={`/workspaces/${workspaceId}/documents`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="border-none shadow-none text-lg font-semibold bg-transparent focus-visible:ring-0 px-0 flex-1 min-w-0"
          placeholder="Document title"
        />
        <Select value={status} onValueChange={handleStatusChange as any}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Editor */}
      <CollaborativeEditor docId={docId} workspaceId={workspaceId} />
    </div>
  );
}
