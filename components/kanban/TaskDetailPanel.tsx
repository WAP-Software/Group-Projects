"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2, getFileUrl, deleteFromR2 } from "@/lib/cloudflare/r2";
import { formatDate, formatBytes, getInitials, priorityColor, cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Flag, Calendar, User, Trash2, Plus, Send, Paperclip,
  Download, X, File, FileText, Image, Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { Task, TaskSubtask, TaskComment, FileRecord, Profile } from "@/types/database";

type Member = { user_id: string; role: string; profile: Profile };
type TaskFileRow = { id: string; task_id: string; file_id: string; file: FileRecord };

interface Props {
  taskId: string | null;
  workspaceId: string;
  members: Member[];
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => Promise<any>;
  onDelete: (id: string) => Promise<void>;
}

function fileIcon(mime: string | null) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

export function TaskDetailPanel({ taskId, workspaceId, members, open, onClose, onUpdate, onDelete }: Props) {
  const supabase = createClient();
  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [comments, setComments] = useState<Array<TaskComment & { profile?: Profile }>>([]);
  const [attachments, setAttachments] = useState<TaskFileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const descSaveRef = useRef<ReturnType<typeof setTimeout>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const loadPanel = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const [taskRes, subtasksRes, commentsRes, filesRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).single(),
      supabase.from("task_subtasks").select("*").eq("task_id", taskId).order("position"),
      supabase.from("task_comments")
        .select("*, profile:profiles(id, full_name, avatar_url, email)")
        .eq("task_id", taskId)
        .order("created_at"),
      supabase.from("task_files")
        .select("*, file:files(*)")
        .eq("task_id", taskId)
        .order("created_at"),
    ]);
    setTask(taskRes.data as Task ?? null);
    setSubtasks((subtasksRes.data ?? []) as TaskSubtask[]);
    setComments((commentsRes.data ?? []) as any);
    setAttachments((filesRes.data ?? []) as any);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) loadPanel();
  }, [open, taskId, loadPanel]);

  async function handleFieldChange(field: keyof Task, value: any) {
    if (!task) return;
    const updated = { ...task, [field]: value };
    setTask(updated as Task);
    await onUpdate(task.id, { [field]: value });
  }

  function handleDescriptionChange(value: string) {
    if (!task) return;
    setTask({ ...task, description: value });
    if (descSaveRef.current) clearTimeout(descSaveRef.current);
    descSaveRef.current = setTimeout(async () => {
      setSaving(true);
      await onUpdate(task.id, { description: value });
      setSaving(false);
    }, 1200);
  }

  // — Subtasks —
  async function addSubtask() {
    if (!newSubtask.trim() || !task) return;
    const { data } = await supabase.from("task_subtasks").insert({
      task_id: task.id,
      title: newSubtask.trim(),
      position: subtasks.length,
    }).select().single();
    if (data) setSubtasks((s) => [...s, data as TaskSubtask]);
    setNewSubtask("");
  }

  async function toggleSubtask(id: string, completed: boolean) {
    setSubtasks((s) => s.map((st) => st.id === id ? { ...st, completed } : st));
    await supabase.from("task_subtasks").update({ completed }).eq("id", id);
  }

  async function assignSubtask(id: string, userId: string | null) {
    setSubtasks((s) => s.map((st) => st.id === id ? { ...st, assigned_to: userId } : st));
    await supabase.from("task_subtasks").update({ assigned_to: userId }).eq("id", id);
  }

  async function deleteSubtask(id: string) {
    setSubtasks((s) => s.filter((st) => st.id !== id));
    await supabase.from("task_subtasks").delete().eq("id", id);
  }

  // — Comments —
  async function addComment() {
    if (!newComment.trim() || !task || !currentUserId) return;
    const { data } = await supabase.from("task_comments").insert({
      task_id: task.id,
      user_id: currentUserId,
      content: newComment.trim(),
    }).select("*, profile:profiles(id, full_name, avatar_url, email)").single();
    if (data) setComments((c) => [...c, data as any]);
    setNewComment("");
  }

  async function deleteComment(id: string) {
    setComments((c) => c.filter((cm) => cm.id !== id));
    await supabase.from("task_comments").delete().eq("id", id);
  }

  // — File upload —
  async function uploadFile(file: File) {
    if (!task) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user || !session?.access_token) { toast.error("Not authenticated"); return; }

    setUploading(true);
    try {
      const { key } = await uploadToR2(file, workspaceId, user.id, session.access_token);
      const { data: fileRecord } = await supabase.from("files").insert({
        workspace_id: workspaceId,
        name: file.name,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        r2_key: key,
        folder_path: "/",
        uploaded_by: user.id,
      }).select().single();
      if (fileRecord) {
        await supabase.from("task_files").insert({ task_id: task.id, file_id: fileRecord.id });
        setAttachments((a) => [...a, { id: crypto.randomUUID(), task_id: task.id, file_id: fileRecord.id, file: fileRecord as FileRecord } as TaskFileRow]);
      }
      toast.success("File attached");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function detachFile(attachmentId: string, r2Key: string) {
    const { data: { session } } = await supabase.auth.getSession();
    setAttachments((a) => a.filter((f) => f.id !== attachmentId));
    await supabase.from("task_files").delete().eq("id", attachmentId);
    if (session?.access_token) deleteFromR2(r2Key, session.access_token).catch(() => {});
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Delete task "${task.title}"?`)) return;
    await onDelete(task.id);
    onClose();
  }

  const subtaskDone = subtasks.filter((s) => s.completed).length;
  const subtaskTotal = subtasks.length;
  const memberById = Object.fromEntries(members.map((m) => [m.user_id, m]));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) uploadFile(f);
        }}
      >
        {dragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <p className="text-primary font-semibold">Drop to attach file</p>
          </div>
        )}

        {loading || !task ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-border space-y-3">
              <div className="flex items-start gap-2">
                <input
                  className="flex-1 text-lg font-semibold bg-transparent border-none outline-none focus:ring-0 resize-none leading-snug"
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                  onBlur={(e) => handleFieldChange("title", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleDelete}
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-2">
                {/* Status */}
                <Select value={task.status} onValueChange={(v) => handleFieldChange("status", v)}>
                  <SelectTrigger className="h-7 text-xs w-auto px-2 gap-1.5 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>

                {/* Priority */}
                <Select value={task.priority} onValueChange={(v) => handleFieldChange("priority", v)}>
                  <SelectTrigger className={cn("h-7 text-xs w-auto px-2 gap-1.5", priorityColor(task.priority))}>
                    <Flag className="h-3 w-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>

                {/* Due date */}
                <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-border/60 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <input
                    type="date"
                    value={task.due_date ?? ""}
                    onChange={(e) => handleFieldChange("due_date", e.target.value || null)}
                    className="bg-transparent border-none outline-none text-xs w-28"
                  />
                </div>

                {/* Assignee */}
                <Select
                  value={task.assigned_to ?? "unassigned"}
                  onValueChange={(v) => handleFieldChange("assigned_to", v === "unassigned" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs w-auto px-2 gap-1.5 border-border/60">
                    <User className="h-3 w-3" />
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name ?? m.profile?.email ?? m.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="details" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="rounded-none border-b border-border bg-transparent h-10 px-5 justify-start gap-1 shrink-0">
                <TabsTrigger value="details" className="text-sm data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  Details
                </TabsTrigger>
                <TabsTrigger value="files" className="text-sm data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  Files {attachments.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({attachments.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="comments" className="text-sm data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
                  Comments {comments.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({comments.length})</span>}
                </TabsTrigger>
              </TabsList>

              {/* Details */}
              <TabsContent value="details" className="flex-1 overflow-y-auto m-0">
                <div className="p-5 space-y-5">
                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                    <Textarea
                      value={task.description ?? ""}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      placeholder="Add a description…"
                      rows={4}
                      className="resize-none text-sm"
                    />
                    {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
                  </div>

                  <Separator />

                  {/* Subtasks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtasks</label>
                      {subtaskTotal > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">{subtaskDone}/{subtaskTotal}</span>
                      )}
                    </div>

                    {subtaskTotal > 0 && (
                      <Progress value={(subtaskDone / subtaskTotal) * 100} className="h-1.5" />
                    )}

                    <div className="space-y-1">
                      {subtasks.map((st) => {
                        const assignedMember = st.assigned_to ? memberById[st.assigned_to] : null;
                        return (
                          <div key={st.id} className="group flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40">
                            <Checkbox
                              checked={st.completed}
                              onCheckedChange={(v) => toggleSubtask(st.id, !!v)}
                              className="shrink-0"
                            />
                            <span className={cn("flex-1 text-sm", st.completed && "line-through text-muted-foreground")}>
                              {st.title}
                            </span>
                            {/* Assignee picker */}
                            <Select
                              value={st.assigned_to ?? "unassigned"}
                              onValueChange={(v) => assignSubtask(st.id, v === "unassigned" ? null : v)}
                            >
                              <SelectTrigger className="h-6 w-6 border-none shadow-none p-0 text-xs [&>svg]:hidden">
                                {assignedMember ? (
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={assignedMember.profile?.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {getInitials(assignedMember.profile?.full_name ?? assignedMember.profile?.email ?? "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-5 w-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <User className="h-2.5 w-2.5 text-muted-foreground" />
                                  </div>
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {members.map((m) => (
                                  <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.profile?.full_name ?? m.profile?.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <button
                              onClick={() => deleteSubtask(st.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                              aria-label="Delete subtask"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add subtask */}
                    <div className="flex gap-2">
                      <Input
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        placeholder="Add subtask…"
                        className="h-8 text-sm"
                        onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
                      />
                      <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0" onClick={addSubtask}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Files */}
              <TabsContent value="files" className="flex-1 overflow-y-auto m-0">
                <div className="p-5 space-y-3">
                  {/* Upload area */}
                  <label
                    className={cn(
                      "flex flex-col items-center gap-2 w-full rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors",
                      dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                    )}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading…" : "Click or drag & drop to attach"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
                    />
                  </label>

                  {/* File list */}
                  {attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No files attached yet</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((att) => (
                        <div key={att.id} className="group flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-border transition-colors">
                          {fileIcon(att.file?.mime_type ?? null)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.file?.name ?? "File"}</p>
                            <p className="text-xs text-muted-foreground">
                              {att.file?.size_bytes ? formatBytes(att.file.size_bytes) : ""}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={getFileUrl(att.file?.r2_key ?? "")}
                              download={att.file?.name}
                              className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <button
                              onClick={() => detachFile(att.id, att.file?.r2_key ?? "")}
                              className="flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Remove file"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Comments */}
              <TabsContent value="comments" className="flex-1 overflow-hidden m-0 flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Start the discussion!</p>
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

                {/* Comment input */}
                <div className="border-t border-border p-3 flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment…"
                    rows={2}
                    className="resize-none text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 self-end pressable"
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    aria-label="Send comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
