"use client";

import { use, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitials, cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Clock, AlertCircle, TrendingUp, File, FileText,
  Table2, Presentation, Link2, ImageIcon, UserPlus,
  Check, CheckCircle2,
} from "lucide-react";
import type { Task, FileRecord, WorkspaceMember, Profile } from "@/types/database";
import { toast } from "sonner";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

type TaskExt = Task & { assignee_ids: string[] };
type Member = WorkspaceMember & { profile: Profile };

type DeadlineItem =
  | { kind: "task"; id: string; item: TaskExt; days: number }
  | { kind: "file"; id: string; item: FileRecord; days: number };

function deadlineDays(date: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d überfällig`;
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  return `${days}d`;
}

function badgeCls(days: number): string {
  if (days <= 0) return "bg-red-500 text-white";
  if (days <= 7) return "bg-yellow-500 text-white";
  return "bg-green-500 text-white";
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-3.5 w-3.5 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-3.5 w-3.5 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return <Table2 className="h-3.5 w-3.5 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="h-3.5 w-3.5 text-orange-500" />;
  if (mime === "text/uri-list") return <Link2 className="h-3.5 w-3.5 text-blue-500" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AvatarStack({ ids, memberMap }: { ids: string[]; memberMap: Record<string, Profile> }) {
  const shown = ids.slice(0, 2);
  const extra = ids.length - 2;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} className="h-6 w-6 ring-2 ring-background shrink-0">
          <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-semibold">
            {getInitials(memberMap[id]?.full_name ?? memberMap[id]?.email ?? "?")}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div className="h-6 w-6 ring-2 ring-background rounded-full bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
}

function SectionHead({ label, dotCls, textCls, count }: { label: string; dotCls: string; textCls: string; count: number }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5", textCls)}>
      <span className={cn("h-2 w-2 rounded-full inline-block shrink-0", dotCls)} />
      {label} ({count})
    </p>
  );
}

export default function WorkspacePage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();

  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [popoverId, setPopoverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [tRes, fRes, mRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("workspace_id", workspaceId).order("position"),
      supabase.from("files").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
      supabase.from("workspace_members").select("*, profile:profiles(*)").eq("workspace_id", workspaceId),
    ]);
    setTasks((tRes.data ?? []).map((t: any) => ({ ...t, assignee_ids: t.assignee_ids ?? [] })));
    setFiles(fRes.data ?? []);
    setMembers((mRes.data ?? []) as Member[]);
    setLoading(false);
  }, [workspaceId, supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!popoverId) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-popover]")) setPopoverId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [popoverId]);

  async function toggleDone(task: TaskExt) {
    const next = task.status === "done" ? "in_progress" : "done";
    await supabase.from("tasks").update({ status: next }).eq("id", task.id);
    setTasks((p) => p.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  async function saveDeadline(id: string, kind: "task" | "file", value: string) {
    if (kind === "task") {
      await supabase.from("tasks").update({ due_date: value || null }).eq("id", id);
      setTasks((p) => p.map((t) => t.id === id ? { ...t, due_date: value || null } : t));
    } else {
      await supabase.from("files").update({ deadline_date: value || null }).eq("id", id);
      setFiles((p) => p.map((f) => f.id === id ? { ...f, deadline_date: value || null } : f));
    }
    setEditingId(null);
    toast.success("Deadline gespeichert");
  }

  async function toggleAssignee(taskId: string, userId: string) {
    const task = tasks.find((t) => t.id === taskId)!;
    const next = task.assignee_ids.includes(userId)
      ? task.assignee_ids.filter((x) => x !== userId)
      : [...task.assignee_ids, userId];
    await supabase.from("tasks").update({ assignee_ids: next } as any).eq("id", taskId);
    setTasks((p) => p.map((t) => t.id === taskId ? { ...t, assignee_ids: next } : t));
  }

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m.profile]));

  const fileItems: DeadlineItem[] = files
    .filter((f) => f.deadline_date)
    .map((f) => ({ kind: "file", id: f.id, item: f, days: deadlineDays(f.deadline_date!) }));

  const taskItems: DeadlineItem[] = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .map((t) => ({ kind: "task", id: t.id, item: t, days: deadlineDays(t.due_date!) }));

  const sorted = [...fileItems, ...taskItems].sort((a, b) => a.days - b.days);
  const overdue = sorted.filter((d) => d.days <= 0);
  const thisWeek = sorted.filter((d) => d.days > 0 && d.days <= 7);
  const later = sorted.filter((d) => d.days > 7);
  const noDate = tasks.filter((t) => !t.due_date && t.status !== "done");

  const totalTasks = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
  const onTrack = overdue.length === 0;

  const rowProps = { memberMap, members, editingId, setEditingId, popoverId, setPopoverId, onToggleDone: toggleDone, onSaveDeadline: saveDeadline, onToggleAssignee: toggleAssignee };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">

      {/* Progress card */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={cn("flex items-center gap-1.5 text-sm font-semibold", onTrack ? "text-green-600 dark:text-green-400" : "text-red-500")}>
            {onTrack
              ? <><TrendingUp className="h-4 w-4" /> On Track</>
              : <><AlertCircle className="h-4 w-4" /> {overdue.length} überfällig</>
            }
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{done}/{totalTasks} erledigt</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      {/* Overdue — pinned */}
      {overdue.length > 0 && (
        <div>
          <SectionHead label="Überfällig" dotCls="bg-red-500" textCls="text-red-500" count={overdue.length} />
          <div className="space-y-1.5">
            {overdue.map((item) => <Row key={item.id} item={item} {...rowProps} />)}
          </div>
        </div>
      )}

      {/* This week */}
      {thisWeek.length > 0 && (
        <div>
          <SectionHead label="Diese Woche" dotCls="bg-yellow-500" textCls="text-yellow-600 dark:text-yellow-400" count={thisWeek.length} />
          <div className="space-y-1.5">
            {thisWeek.map((item) => <Row key={item.id} item={item} {...rowProps} />)}
          </div>
        </div>
      )}

      {/* Later */}
      {later.length > 0 && (
        <div>
          <SectionHead label="Später" dotCls="bg-green-500" textCls="text-green-600 dark:text-green-400" count={later.length} />
          <div className="space-y-1.5">
            {later.map((item) => <Row key={item.id} item={item} {...rowProps} />)}
          </div>
        </div>
      )}

      {/* No deadline tasks */}
      {noDate.length > 0 && (
        <div>
          <SectionHead label="Kein Datum" dotCls="bg-muted-foreground/40" textCls="text-muted-foreground" count={noDate.length} />
          <div className="space-y-1.5">
            {noDate.map((task) => (
              <Row key={task.id} item={{ kind: "task", id: task.id, item: task, days: 999 }} {...rowProps} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {totalTasks === 0 && files.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="font-semibold">Noch nichts hier</p>
          <p className="text-sm text-muted-foreground mt-1">Erstelle Tasks im Kanban oder lade Dateien hoch.</p>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  item: DeadlineItem;
  memberMap: Record<string, Profile>;
  members: Member[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  popoverId: string | null;
  setPopoverId: (id: string | null) => void;
  onToggleDone: (task: TaskExt) => void;
  onSaveDeadline: (id: string, kind: "task" | "file", value: string) => void;
  onToggleAssignee: (taskId: string, userId: string) => void;
}

function Row({ item, memberMap, members, editingId, setEditingId, popoverId, setPopoverId, onToggleDone, onSaveDeadline, onToggleAssignee }: RowProps) {
  const isTask = item.kind === "task";
  const task = isTask ? item.item as TaskExt : null;
  const file = !isTask ? item.item as FileRecord : null;
  const isDone = task?.status === "done";
  const isEditing = editingId === item.id;
  const isPopover = popoverId === item.id;
  const days = item.days;
  const deadlineVal = (isTask ? task?.due_date : file?.deadline_date) ?? "";
  const hasDeadline = deadlineVal !== "" && days !== 999;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 group transition-all",
      isDone ? "opacity-50 border-border/30" : "border-border/50 hover:border-primary/30 hover:bg-muted/20",
      days <= 0 && !isDone ? "border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20" : "",
    )}>

      {/* Left: checkbox (task) or file icon */}
      {isTask ? (
        <button
          onClick={() => onToggleDone(task!)}
          className={cn(
            "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors pressable",
            isDone ? "bg-green-500 border-green-500" : "border-muted-foreground/40 hover:border-primary",
          )}
          aria-label={isDone ? "Wieder öffnen" : "Als erledigt markieren"}
        >
          {isDone && <Check className="h-3 w-3 text-white" />}
        </button>
      ) : (
        <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
          <FileIcon mime={file?.mime_type ?? null} />
        </div>
      )}

      {/* Name */}
      <p className={cn("flex-1 text-sm font-medium truncate min-w-0", isDone && "line-through text-muted-foreground")}>
        {isTask ? task?.title : file?.name}
        {isTask && <span className="ml-1.5 text-xs text-muted-foreground font-normal capitalize">{task?.status?.replace("_", " ")}</span>}
      </p>

      {/* Deadline badge / inline editor */}
      <div className="shrink-0">
        {isEditing ? (
          <input
            type="date"
            autoFocus
            defaultValue={deadlineVal.slice(0, 10)}
            className="text-xs border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary w-[130px]"
            onBlur={(e) => onSaveDeadline(item.id, item.kind, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveDeadline(item.id, item.kind, (e.target as HTMLInputElement).value);
              if (e.key === "Escape") setEditingId(null);
            }}
          />
        ) : (
          <button
            onClick={() => setEditingId(item.id)}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-all",
              hasDeadline
                ? badgeCls(days)
                : "bg-transparent text-muted-foreground border border-dashed border-border opacity-0 group-hover:opacity-100",
            )}
          >
            {hasDeadline ? (
              <>{days <= 0 ? <AlertCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />} {deadlineLabel(days)}</>
            ) : (
              <><Clock className="h-2.5 w-2.5" /> Datum</>
            )}
          </button>
        )}
      </div>

      {/* Assignees (tasks only) */}
      {isTask && (
        <div className="relative shrink-0" data-popover>
          <button
            onClick={() => setPopoverId(isPopover ? null : item.id)}
            className="flex items-center pressable"
            aria-label="Zuteilung ändern"
          >
            {task!.assignee_ids.length > 0 ? (
              <AvatarStack ids={task!.assignee_ids} memberMap={memberMap} />
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UserPlus className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </button>

          {isPopover && (
            <div className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-0.5">
              <p className="text-xs text-muted-foreground px-2 pb-1">Zuteilen</p>
              {members.map((m) => {
                const p = m.profile;
                const assigned = task!.assignee_ids.includes(m.user_id);
                return (
                  <button
                    key={m.user_id}
                    onClick={() => onToggleAssignee(task!.id, m.user_id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                      assigned ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-[9px] bg-primary/20 text-primary font-semibold">
                        {getInitials(p?.full_name ?? p?.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-left">{p?.full_name ?? p?.email}</span>
                    {assigned && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
