"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl, downloadFile } from "@/lib/cloudflare/r2";
import { formatDate, formatBytes, getInitials, cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, X, Send, ExternalLink, File, FileText,
  ImageIcon, Table2, Presentation, Kanban, Calendar, Flag,
} from "lucide-react";
import { toast } from "sonner";
import type { FileRecord, Task, Profile } from "@/types/database";
import { priorityColor } from "@/lib/utils";

type FileComment = {
  id: string;
  file_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
};

type LinkedTask = Task & { subtask_count?: number };

function fileTypeIcon(mime: string | null) {
  if (!mime) return <File className="h-5 w-5 text-slate-400" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv"))
    return <Table2 className="h-5 w-5 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className="h-5 w-5 text-orange-500" />;
  return <File className="h-5 w-5 text-slate-400" />;
}

function canPreview(mime: string | null): "image" | "pdf" | "none" {
  if (!mime) return "none";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "none";
}

interface Props {
  file: FileRecord | null;
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export function FileDetailPanel({ file, workspaceId, open, onClose }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<FileComment[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    const [commentsRes, tasksRes] = await Promise.all([
      supabase
        .from("file_comments")
        .select("*, profile:profiles(id, full_name, avatar_url, email)")
        .eq("file_id", file.id)
        .order("created_at"),
      supabase
        .from("task_files")
        .select("task:tasks(*)")
        .eq("file_id", file.id),
    ]);
    setComments((commentsRes.data ?? []) as any);
    setLinkedTasks(((tasksRes.data ?? []).map((r: any) => r.task).filter(Boolean)) as LinkedTask[]);
    setLoading(false);
  }, [file?.id]);

  useEffect(() => {
    if (open && file) load();
  }, [open, file, load]);

  async function addComment() {
    if (!newComment.trim() || !file || !currentUserId) return;
    const { data } = await supabase
      .from("file_comments")
      .insert({ file_id: file.id, user_id: currentUserId, content: newComment.trim() })
      .select("*, profile:profiles(id, full_name, avatar_url, email)")
      .single();
    if (data) setComments((c) => [...c, data as any]);
    setNewComment("");
  }

  async function deleteComment(id: string) {
    setComments((c) => c.filter((cm) => cm.id !== id));
    await supabase.from("file_comments").delete().eq("id", id);
  }

  if (!file) return null;

  const fileUrl = getFileUrl(file.r2_key);
  const previewType = canPreview(file.mime_type);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="p-5 border-b border-border space-y-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{fileTypeIcon(file.mime_type)}</div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base leading-snug break-all">{file.name}</h2>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {file.mime_type && (
                  <Badge variant="secondary" className="text-xs">{file.mime_type.split("/")[1]?.toUpperCase() ?? file.mime_type}</Badge>
                )}
                {file.size_bytes && (
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</span>
                )}
                <span className="text-xs text-muted-foreground">{formatDate(file.created_at)}</span>
              </div>
            </div>
            <button
              onClick={() => downloadFile(file.r2_key, file.original_name).catch(() => toast.error("Download fehlgeschlagen"))}
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Preview */}
        {previewType !== "none" && (
          <div className="border-b border-border bg-muted/30 flex items-center justify-center" style={{ height: 220 }}>
            {previewType === "image" && (
              <img src={fileUrl} alt={file.name} className="max-h-full max-w-full object-contain p-2" />
            )}
            {previewType === "pdf" && (
              <iframe src={fileUrl} className="w-full h-full" title={file.name} />
            )}
          </div>
        )}

        {previewType === "none" && (
          <div className="border-b border-border bg-muted/20 flex flex-col items-center justify-center gap-2 py-6">
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              {fileTypeIcon(file.mime_type)}
            </div>
            <p className="text-sm text-muted-foreground">No preview available</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open file
            </a>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="comments" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="rounded-none border-b border-border bg-transparent h-10 px-5 justify-start gap-1 shrink-0">
            <TabsTrigger value="comments" className="text-sm data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Comments {comments.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({comments.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Linked Tasks {linkedTasks.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({linkedTasks.length})</span>}
            </TabsTrigger>
          </TabsList>

          {/* Comments */}
          <TabsContent value="comments" className="flex-1 overflow-hidden m-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No comments yet — start the discussion!
                  </p>
                ) : (
                  comments.map((cm) => {
                    const p = (cm as any).profile as Profile | null;
                    return (
                      <div key={cm.id} className="group flex gap-3">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarImage src={p?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getInitials(p?.full_name ?? p?.email ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">{p?.full_name ?? p?.email ?? "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(cm.created_at)}</span>
                          </div>
                          <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{cm.content}</p>
                        </div>
                        {cm.user_id === currentUserId && (
                          <button
                            onClick={() => deleteComment(cm.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-1"
                            aria-label="Delete comment"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3 flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="resize-none text-sm flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 self-end pressable"
                onClick={addComment}
                disabled={!newComment.trim()}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Linked Tasks */}
          <TabsContent value="tasks" className="flex-1 overflow-y-auto m-0">
            <div className="p-5 space-y-2">
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : linkedTasks.length === 0 ? (
                <div className="text-center py-10">
                  <Kanban className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No tasks linked to this file yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Attach this file to a task via the Kanban board.</p>
                </div>
              ) : (
                linkedTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0", {
                      "bg-slate-400": task.status === "backlog",
                      "bg-blue-500": task.status === "in_progress",
                      "bg-yellow-500": task.status === "review",
                      "bg-green-500": task.status === "done",
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs capitalize">{task.status.replace("_", " ")}</Badge>
                        <Badge className={cn("text-xs gap-1", priorityColor(task.priority))}>
                          <Flag className="h-2.5 w-2.5" />{task.priority}
                        </Badge>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
