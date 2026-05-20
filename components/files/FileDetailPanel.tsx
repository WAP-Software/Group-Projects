"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getFileUrl, downloadFile, uploadToR2, deleteFromR2 } from "@/lib/cloudflare/r2";
import { formatDate, formatBytes, getInitials, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, X, Send, File, FileText,
  ImageIcon, Table2, Presentation, Kanban, Calendar, Flag,
  Eye, Tag, Plus, Link2, Upload,
  ClipboardCheck, History, Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { FileRecord, Task, Profile, Review } from "@/types/database";
import { priorityColor } from "@/lib/utils";
import Papa from "papaparse";

type FileComment = {
  id: string;
  file_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
};

type LinkedTask = Task & { subtask_count?: number };

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_review: "bg-blue-100 text-blue-700",
  changes_requested: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
};

function fileTypeIcon(mime: string | null) {
  if (!mime) return <File className="h-5 w-5 text-slate-400" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv"))
    return <Table2 className="h-5 w-5 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return <Presentation className="h-5 w-5 text-orange-500" />;
  if (mime === "text/uri-list") return <Link2 className="h-5 w-5 text-blue-500" />;
  return <File className="h-5 w-5 text-slate-400" />;
}

function canPreview(mime: string | null): "image" | "pdf" | "csv" | "none" {
  if (!mime) return "none";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  // only plain-text CSV — binary spreadsheets (xlsx, xls, ods) cannot be parsed
  if (mime === "text/csv" || mime === "text/plain" || mime === "application/csv") return "csv";
  return "none";
}

interface Props {
  file: FileRecord | null;
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function FileDetailPanel({ file, workspaceId, open, onClose, onRefresh }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [comments, setComments] = useState<FileComment[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [versions, setVersions] = useState<FileRecord[]>([]);
  const [linkedReviews, setLinkedReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newVersionUploading, setNewVersionUploading] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const versionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    supabase
      .from("workspace_members")
      .select("profile:profiles(id, full_name, avatar_url, email)")
      .eq("workspace_id", workspaceId)
      .then(({ data }) => setMembers((data ?? []).map((m: any) => m.profile).filter(Boolean)));
  }, [workspaceId]);

  useEffect(() => {
    if (file) setTags(file.tags ?? []);
  }, [file?.id]);

  const load = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    const [commentsRes, tasksRes, versionsRes, reviewsRes] = await Promise.all([
      supabase
        .from("file_comments")
        .select("*, profile:profiles(id, full_name, avatar_url, email)")
        .eq("file_id", file.id)
        .order("created_at"),
      supabase
        .from("task_files")
        .select("task:tasks(*)")
        .eq("file_id", file.id),
      supabase
        .from("files")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("original_name", file.original_name)
        .order("version", { ascending: false }),
      supabase
        .from("reviews")
        .select("*")
        .eq("workspace_id", workspaceId)
        .or(`document_id.eq.${file.id},file_id.eq.${file.id}`)
        .order("created_at", { ascending: false }),
    ]);
    setComments((commentsRes.data ?? []) as any);
    setLinkedTasks(((tasksRes.data ?? []).map((r: any) => r.task).filter(Boolean)) as LinkedTask[]);
    setVersions((versionsRes.data ?? []) as FileRecord[]);
    setLinkedReviews((reviewsRes.data ?? []) as Review[]);

    // Load CSV if applicable
    const previewType = canPreview(file.mime_type);
    if (previewType === "csv" && file.r2_key) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const url = getFileUrl(file.r2_key);
        const res = await fetch(url, session?.access_token ? { headers: { Authorization: `Bearer ${session.access_token}` } } : undefined);
        const text = await res.text();
        const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
        setCsvData(parsed.data.slice(0, 50));
      } catch { setCsvData([]); }
    }
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

  async function saveTags() {
    if (!file) return;
    await supabase.from("files").update({ tags }).eq("id", file.id);
    setEditingTags(false);
    toast.success("Tags saved");
    onRefresh?.();
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  async function uploadNewVersion(f: File) {
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setNewVersionUploading(true);
    try {
      const { key } = await uploadToR2(f, workspaceId, user.id, token);
      const newVersion = (versions[0]?.version ?? file.version) + 1;
      await supabase.from("files").insert({
        workspace_id: workspaceId,
        name: file.name,
        original_name: file.original_name,
        mime_type: f.type || file.mime_type,
        size_bytes: f.size,
        r2_key: key,
        folder_path: file.folder_path,
        uploaded_by: user.id,
        version: newVersion,
        parent_version_id: file.id,
        tags: file.tags,
        is_pinned: false,
      });

      // Enforce max 3 versions: delete oldest if exceeded
      const { data: allVersions } = await supabase
        .from("files")
        .select("id, r2_key, version")
        .eq("workspace_id", workspaceId)
        .eq("original_name", file.original_name)
        .order("version", { ascending: true });
      if (allVersions && allVersions.length > 3) {
        const toDelete = allVersions.slice(0, allVersions.length - 3);
        for (const v of toDelete) {
          if (v.r2_key) await deleteFromR2(v.r2_key, token).catch(() => {});
          await supabase.from("files").delete().eq("id", v.id);
        }
      }

      toast.success(`Version ${newVersion} uploaded`);
      load();
      onRefresh?.();
    } catch {
      toast.error("Upload failed");
    } finally {
      setNewVersionUploading(false);
    }
  }

  async function handleDownload(r2Key: string, filename: string) {
    const { data: { session } } = await supabase.auth.getSession();
    await downloadFile(r2Key, filename, session?.access_token).catch(() => toast.error("Download failed"));
  }

  async function startReview() {
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); return; }
    const { data, error } = await supabase.from("reviews").insert({
      workspace_id: workspaceId,
      document_id: file.id,
      title: `Review: ${file.name}`,
      status: "pending",
      submitted_by: user.id,
    }).select().single();
    if (error) { toast.error("Review could not be created"); return; }
    toast.success("Peer review started!");
    load();
  }

  if (!file) return null;

  const fileUrl = file.r2_key ? getFileUrl(file.r2_key) : null;
  const previewType = canPreview(file.mime_type);

  const tabCount = {
    comments: comments.length,
    tasks: linkedTasks.length,
    versions: versions.length,
    reviews: linkedReviews.length,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl w-full h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          <VisuallyHidden><DialogTitle>{file.name}</DialogTitle></VisuallyHidden>
          <VisuallyHidden><DialogDescription>File details</DialogDescription></VisuallyHidden>
          {/* Header */}
          <div className="p-5 border-b border-border space-y-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{fileTypeIcon(file.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base leading-snug break-all">{file.name}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {file.mime_type && !file.external_url && (
                    <Badge variant="secondary" className="text-xs">{file.mime_type.split("/")[1]?.toUpperCase() ?? file.mime_type}</Badge>
                  )}
                  {file.external_url && <Badge variant="secondary" className="text-xs">External link</Badge>}
                  {file.size_bytes ? <span className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</span> : null}
                  <span className="text-xs text-muted-foreground">{formatDate(file.created_at)}</span>
                  {file.version > 1 && <Badge variant="outline" className="text-xs">v{file.version}</Badge>}
                  {file.deadline_date && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3 w-3" /> {formatDate(file.deadline_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(previewType !== "none" || file.external_url) && (
                  <button
                    onClick={() => file.external_url ? window.open(file.external_url!, "_blank") : setPreviewOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                    aria-label="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
                {!file.external_url && (
                  <button
                    onClick={() => handleDownload(file.r2_key, file.original_name)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
                    aria-label="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  {tag}
                  {editingTags && (
                    <button onClick={() => setTags((t) => t.filter((x) => x !== tag))} className="ml-0.5 hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </Badge>
              ))}
              {editingTags ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="Enter tag…"
                    className="h-6 text-xs w-28 px-2"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addTag}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={saveTags}>OK</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setEditingTags(false); setTags(file.tags ?? []); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingTags(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Tag className="h-3 w-3" /> Edit tags
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="comments" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="rounded-none border-b border-border bg-transparent h-10 px-3 justify-start gap-0 shrink-0 overflow-x-auto">
              {[
                { value: "comments", label: "Comments", count: tabCount.comments },
                { value: "tasks", label: "Tasks", count: tabCount.tasks },
                { value: "versions", label: "Versions", count: tabCount.versions },
                { value: "reviews", label: "Reviews", count: tabCount.reviews },
              ].map(({ value, label, count }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="text-xs data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3 shrink-0"
                >
                  {label}
                  {count > 0 && <span className="ml-1 text-muted-foreground">({count})</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Comments */}
            <TabsContent value="comments" className="flex-1 overflow-hidden m-0 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-4">
                  {loading ? (
                    <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No comments yet — start the discussion!</p>
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
                            <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">{renderCommentContent(cm.content, members)}</p>
                          </div>
                          {cm.user_id === currentUserId && (
                            <button
                              onClick={() => deleteComment(cm.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 mt-1"
                              aria-label="Delete"
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
                <div className="relative flex-1">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment… @Name to mention someone"
                    rows={2}
                    className="resize-none text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                  />
                  {newComment.includes("@") && (
                    <MentionSuggestions
                      text={newComment}
                      members={members}
                      onSelect={(name) => {
                        const parts = newComment.split("@");
                        const before = parts.slice(0, -1).join("@");
                        setNewComment(`${before}@${name} `);
                      }}
                    />
                  )}
                </div>
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
                    <p className="text-sm text-muted-foreground">No tasks linked yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Link this file to a task via the Kanban board.</p>
                  </div>
                ) : (
                  linkedTasks.map((task) => (
                    <div key={task.id} onClick={() => { onClose(); router.push(`/workspaces/${workspaceId}/tasks`); }} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
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

            {/* Versions */}
            <TabsContent value="versions" className="flex-1 overflow-y-auto m-0">
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version history</p>
                  {!file.external_url && (
                    <label className="cursor-pointer">
                      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" disabled={newVersionUploading} asChild>
                        <span>
                          <Upload className="h-3 w-3" />
                          {newVersionUploading ? "Uploading…" : "New version"}
                        </span>
                      </Button>
                      <input
                        ref={versionInputRef}
                        type="file"
                        className="sr-only"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadNewVersion(f); e.target.value = ""; }}
                      />
                    </label>
                  )}
                </div>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : versions.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No versions yet.</p>
                  </div>
                ) : (
                  versions.map((v) => (
                    <div key={v.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      v.id === file.id ? "border-primary/40 bg-primary/5" : "border-border/50 hover:bg-muted/30"
                    )}>
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                        v{v.version}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(v.created_at)} {v.size_bytes ? `· ${formatBytes(v.size_bytes)}` : ""}</p>
                      </div>
                      {v.id === file.id && <Badge className="text-xs shrink-0">Current</Badge>}
                      {v.r2_key && (
                        <button
                          onClick={() => handleDownload(v.r2_key, v.original_name)}
                          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Reviews */}
            <TabsContent value="reviews" className="flex-1 overflow-y-auto m-0">
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peer reviews</p>
                  {!file.external_url && (
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={startReview}>
                      <ClipboardCheck className="h-3 w-3" /> Start review
                    </Button>
                  )}
                </div>
                {linkedReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No review started yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Start review" to create a peer review for this file.</p>
                  </div>
                ) : (
                  linkedReviews.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <ClipboardCheck className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", REVIEW_STATUS_COLOR[r.status])}>
                        {REVIEW_STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Lightbox preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className={cn(
          "p-0 flex flex-col gap-0",
          previewType === "csv" ? "max-w-[90vw] w-[90vw] h-[80vh]" : "max-w-[95vw] w-[95vw] h-[90vh]",
        )}>
          <VisuallyHidden><DialogTitle>{file.name}</DialogTitle></VisuallyHidden>
          <VisuallyHidden><DialogDescription>File preview</DialogDescription></VisuallyHidden>
          <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {fileTypeIcon(file.mime_type)}
              <span className="text-sm font-medium truncate">{file.name}</span>
              {file.version > 1 && <Badge variant="secondary" className="text-xs shrink-0">v{file.version}</Badge>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {fileUrl && previewType !== "none" && (
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => handleDownload(file.r2_key, file.original_name)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              )}
              <button onClick={() => setPreviewOpen(false)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Image */}
          {previewType === "image" && fileUrl && (
            <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden">
              <img src={fileUrl} alt={file.name} className="max-h-full max-w-full object-contain p-4" />
            </div>
          )}

          {/* PDF */}
          {previewType === "pdf" && fileUrl && (
            <iframe src={fileUrl} className="flex-1 w-full" title={file.name} />
          )}

          {/* CSV / spreadsheet */}
          {previewType === "csv" && (
            <div className="flex-1 overflow-auto">
              {csvData.length > 0 ? (
                <table className="text-xs w-full">
                  <thead className="bg-muted/40 sticky top-0 z-10">
                    <tr>
                      {(csvData[0] ?? []).map((cell, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold border-r border-border/40 last:border-0 whitespace-nowrap">{cell}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-border/20 hover:bg-muted/20">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 border-r border-border/20 last:border-0 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Loading preview…
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function renderCommentContent(text: string, members: Profile[]): React.ReactNode {
  const parts = text.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      const name = part.slice(1).trim();
      const mentioned = members.find((m) => m.full_name?.toLowerCase() === name.toLowerCase() || m.email?.toLowerCase() === name.toLowerCase());
      if (mentioned) {
        return (
          <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">
            {part}
          </span>
        );
      }
    }
    return part;
  });
}

function MentionSuggestions({
  text,
  members,
  onSelect,
}: {
  text: string;
  members: Profile[];
  onSelect: (name: string) => void;
}) {
  const lastAt = text.lastIndexOf("@");
  if (lastAt === -1) return null;
  const query = text.slice(lastAt + 1).toLowerCase();
  const matches = members.filter(
    (m) =>
      (m.full_name?.toLowerCase().includes(query) || m.email?.toLowerCase().includes(query)) &&
      query.length < 20
  );
  if (matches.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-lg shadow-lg z-10 overflow-hidden">
      {matches.slice(0, 5).map((m) => (
        <button
          key={m.id}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
          onMouseDown={(e) => { e.preventDefault(); onSelect(m.full_name ?? m.email); }}
        >
          <Avatar className="h-5 w-5">
            <AvatarImage src={m.avatar_url ?? undefined} />
            <AvatarFallback className="text-[8px]">{getInitials(m.full_name ?? m.email)}</AvatarFallback>
          </Avatar>
          {m.full_name ?? m.email}
        </button>
      ))}
    </div>
  );
}
