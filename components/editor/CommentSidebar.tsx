"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DocumentComment } from "@/types/database";

interface Props {
  documentId: string;
}

interface CommentWithProfile extends DocumentComment {
  profile?: { full_name: string | null; avatar_url: string | null };
}

export function CommentSidebar({ documentId }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadComments();
    const sub = supabase
      .channel(`comments:${documentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_comments", filter: `document_id=eq.${documentId}` }, loadComments)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [documentId]);

  async function loadComments() {
    const { data } = await supabase
      .from("document_comments")
      .select("*, profile:profiles(full_name, avatar_url)")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    setComments((data as CommentWithProfile[]) ?? []);
  }

  async function addComment() {
    if (!newComment.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("document_comments").insert({
      document_id: documentId,
      user_id: user.id,
      content: newComment,
    });
    if (error) { toast.error("Failed to add comment"); } else { setNewComment(""); }
    setLoading(false);
  }

  async function toggleResolve(id: string, resolved: boolean) {
    await supabase.from("document_comments").update({ resolved: !resolved }).eq("id", id);
  }

  const visible = comments.filter((c) => showResolved || !c.resolved);

  return (
    <div className="w-72 border-l border-border bg-muted/20 flex flex-col hidden lg:flex">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Comments</span>
          <Badge variant="secondary" className="text-xs">{comments.filter((c) => !c.resolved).length}</Badge>
        </div>
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showResolved ? "Hide resolved" : "Show resolved"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No comments yet</p>
        ) : (
          visible.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-lg p-3 text-sm border ${comment.resolved ? "opacity-50 bg-muted/30 border-border/30" : "bg-background border-border/50"}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(comment.profile?.full_name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">{comment.profile?.full_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatRelativeTime(comment.created_at)}</span>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{comment.content}</p>
              {!comment.resolved && (
                <button
                  onClick={() => toggleResolve(comment.id, comment.resolved)}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-green-600 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Resolve
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <Textarea
          placeholder="Add a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          className="resize-none text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) addComment(); }}
        />
        <Button size="sm" className="w-full pressable" onClick={addComment} disabled={loading || !newComment.trim()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Comment"}
        </Button>
      </div>
    </div>
  );
}
